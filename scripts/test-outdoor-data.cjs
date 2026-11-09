const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "firebase", "firestore.ts"),
  "utf8",
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function createFirestore({ failDeletePath } = {}) {
  const records = new Map();
  const removed = Symbol("deleteField");
  let nextId = 0;
  const api = {
    getFirestore: () => ({}),
    collection: (_db, ...segments) => ({ path: segments.join("/") }),
    doc: (parent, ...segments) => {
      if (parent.path) {
        return { path: `${parent.path}/${segments[0] || `auto-${++nextId}`}`, id: segments[0] || `auto-${nextId}` };
      }
      return { path: segments.join("/"), id: segments.at(-1) };
    },
    serverTimestamp: () => "server-timestamp",
    deleteField: () => removed,
    setDoc: async (ref, data, options) => {
      const merged = options?.merge ? { ...records.get(ref.path), ...data } : { ...data };
      for (const [key, value] of Object.entries(merged)) {
        if (value === undefined) throw new Error(`Unexpected undefined field: ${key}`);
        if (value === removed) delete merged[key];
      }
      records.set(ref.path, merged);
    },
    updateDoc: async (ref, data) => {
      if (!records.has(ref.path)) throw new Error("Missing document");
      records.set(ref.path, { ...records.get(ref.path), ...data });
    },
    getDoc: async (ref) => ({
      exists: () => records.has(ref.path),
      data: () => records.get(ref.path),
    }),
    getDocs: async (ref) => ({
      docs: [...records.entries()]
        .filter(([key]) => key.startsWith(`${ref.path}/`))
        .map(([key, data]) => ({ ref: { path: key }, data: () => data })),
    }),
    deleteDoc: async (ref) => {
      if (ref.path === failDeletePath) throw new Error("Delete failed");
      records.delete(ref.path);
    },
  };
  const mod = { exports: {} };
  const localRequire = (name) => {
    if (name === "firebase/firestore") return api;
    if (name === "./app") return { firebaseApp: {} };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "module", "exports", javascript)(localRequire, mod, mod.exports);
  return mod.exports;
}

test("daily challenge progress can be created, read, updated, restarted and deleted", async () => {
  const db = createFirestore();
  const id = "daily-2026-11-09";
  assert.equal(await db.getChallengeProgress("user-a", id), null);
  await db.saveChallengeProgress("user-a", id, { status: "started", startedAt: new Date() });
  assert.equal((await db.getChallengeProgress("user-a", id)).status, "started");
  await db.saveChallengeProgress("user-a", id, { status: "completed", completedAt: new Date() });
  assert.equal((await db.getChallengeProgress("user-a", id)).status, "completed");
  await db.saveChallengeProgress("user-a", id, { status: "started", startedAt: new Date() });
  assert.equal("completedAt" in (await db.getChallengeProgress("user-a", id)), false);
  assert.equal(await db.getChallengeProgress("user-b", id), null);
  await db.deleteChallengeProgress("user-a", id);
  assert.equal(await db.getChallengeProgress("user-a", id), null);
});

test("saved places can be created, listed, renamed and deleted per user", async () => {
  const db = createFirestore();
  await db.createSavedPlace("user-a", { name: "Quiet park", address: "Near home" });
  let places = await db.listSavedPlaces("user-a");
  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Quiet park");
  assert.equal(places[0].savedAt, "server-timestamp");
  assert.equal((await db.listSavedPlaces("user-b")).length, 0);
  await db.renameSavedPlace("user-a", places[0].placeId, "Green park");
  places = await db.listSavedPlaces("user-a");
  assert.equal(places[0].name, "Green park");
  await db.deleteSavedPlace("user-a", places[0].placeId);
  assert.deepEqual(await db.listSavedPlaces("user-a"), []);
});

test("incomplete account cleanup preserves the profile for a retry", async () => {
  const db = createFirestore({ failDeletePath: "users/user-a/savedPlaces/auto-1" });
  await db.saveUserProfile("user-a", { onboardingCompleted: true });
  await db.createSavedPlace("user-a", { name: "Quiet park" });
  assert.equal(await db.deleteUserData("user-a"), false);
  assert.equal((await db.getUserProfile("user-a")).onboardingCompleted, true);
  assert.equal((await db.listSavedPlaces("user-a")).length, 1);
});

test("registering an existing profile preserves completed onboarding and terms timestamp", async () => {
  const db = createFirestore();
  await db.createUserProfile("user-a", {
    onboardingCompleted: true,
    termsAccepted: true,
    termsAcceptedAt: "original-consent",
  });
  await db.saveRegisteredUserProfile("user-a", {
    onboardingCompleted: false,
    displayName: "Returning user",
    authProvider: "google.com",
  });
  const profile = await db.getUserProfile("user-a");
  assert.equal(profile.onboardingCompleted, true);
  assert.equal(profile.termsAcceptedAt, "original-consent");
});
