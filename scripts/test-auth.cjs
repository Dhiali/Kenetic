const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "firebase", "auth.ts"),
  "utf8",
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function createAuth(user) {
  const calls = [];
  const auth = { currentUser: user };
  const firebase = {
    initializeAuth: () => auth,
    getReactNativePersistence: () => ({}),
    EmailAuthProvider: {
      credential: (email, password) => ({ email, password }),
    },
    reauthenticateWithCredential: async (currentUser, credential) => {
      calls.push({ operation: "reauthenticate", currentUser, credential });
    },
    updateEmail: async (currentUser, email) => {
      calls.push({ operation: "update", currentUser, email });
    },
  };
  const mod = { exports: {} };
  const localRequire = (name) => {
    if (name === "firebase/auth") return firebase;
    if (name === "@react-native-async-storage/async-storage") return {};
    if (name === "react-native") return { Platform: { OS: "ios" } };
    if (name === "./app") return { firebaseApp: {} };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "module", "exports", javascript)(localRequire, mod, mod.exports);
  return { api: mod.exports, calls };
}

test("email change reauthenticates with the current address before updating", async () => {
  const user = { email: "old@example.com", isAnonymous: false };
  const { api, calls } = createAuth(user);
  await api.updateCurrentUserEmail("new@example.com", "password");
  assert.deepEqual(calls, [
    { operation: "reauthenticate", currentUser: user, credential: { email: "old@example.com", password: "password" } },
    { operation: "update", currentUser: user, email: "new@example.com" },
  ]);
});

test("email change rejects accounts without a current email", async () => {
  const { api, calls } = createAuth({ email: null, isAnonymous: false });
  await assert.rejects(api.updateCurrentUserEmail("new@example.com", "password"), /sign in again/i);
  assert.deepEqual(calls, []);
});
