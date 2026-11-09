const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "firebase", "bootstrap.ts"), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function setup({ user, profile, intention = false, profileError } = {}) {
  const created = [];
  const auth = {
    ensureAnonymousUser: async () => user,
  };
  const firestore = {
    getUserProfile: async () => {
      if (profileError) throw profileError;
      return profile ?? null;
    },
    createUserProfile: async (uid, data) => {
      for (const [key, value] of Object.entries(data)) {
        assert.notEqual(value, undefined, `Unexpected undefined ${key}`);
      }
      created.push({ uid, data });
      profile = data;
    },
    hasInitialIntention: async () => intention,
  };
  const mod = { exports: {} };
  const localRequire = (name) => {
    if (name === "./auth") return auth;
    if (name === "./firestore") return firestore;
    if (name === "./notifications" || name === "./storage") return {};
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "module", "exports", javascript)(localRequire, mod, mod.exports);
  return { api: mod.exports, created };
}

test("anonymous startup creates a valid profile without undefined email", async () => {
  const { api, created } = setup({ user: { uid: "anon", isAnonymous: true, email: null } });
  assert.equal(await api.restoreSignedInAccount(), "FORK");
  assert.deepEqual(created, [{ uid: "anon", data: { onboardingCompleted: false, authProvider: "anonymous" } }]);
});

test("signed-in accounts resume the appropriate onboarding stage", async () => {
  const user = { uid: "user", isAnonymous: false };
  for (const [profile, intention, expected] of [
    [{ onboardingCompleted: true }, false, "DASHBOARD"],
    [{ onboardingCompleted: false }, false, "CAROUSEL"],
    [{ onboardingCompleted: false }, true, "FOG"],
  ]) {
    const { api } = setup({ user, profile, intention });
    assert.equal(await api.restoreSignedInAccount(), expected);
  }
});

test("profile errors propagate rather than being treated as signed out", async () => {
  const { api } = setup({
    user: { uid: "user", isAnonymous: false },
    profileError: new Error("profile unavailable"),
  });
  await assert.rejects(api.restoreSignedInAccount(), /profile unavailable/);
});

test("missing signed-in profiles are recovered without pretending they are anonymous", async () => {
  const { api, created } = setup({
    user: {
      uid: "user",
      isAnonymous: false,
      email: "person@example.com",
      displayName: "Person",
      providerData: [{ providerId: "password" }],
    },
  });
  assert.equal(await api.restoreSignedInAccount(), "CAROUSEL");
  assert.deepEqual(created, [{
    uid: "user",
    data: {
      onboardingCompleted: false,
      email: "person@example.com",
      displayName: "Person",
      authProvider: "password",
    },
  }]);
});
