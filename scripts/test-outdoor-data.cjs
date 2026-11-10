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
const activitySource = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "focus", "activity.ts"),
  "utf8",
);
const activityJavascript = ts.transpileModule(activitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const activityModule = { exports: {} };
new Function("module", "exports", activityJavascript)(activityModule, activityModule.exports);

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
    where: (field, _operator, value) => ({ field, value }),
    query: (ref, filter) => ({ ...ref, filter }),
    runTransaction: async (_db, update) => update({
      get: async (ref) => ({ exists: () => records.has(ref.path), data: () => records.get(ref.path) }),
      set: (ref, data) => records.set(ref.path, data),
    }),
    addDoc: async (ref, data) => {
      const id = `auto-${++nextId}`;
      records.set(`${ref.path}/${id}`, data);
      return { id };
    },
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
        .filter(([, data]) => !ref.filter || data[ref.filter.field] === ref.filter.value)
        .map(([key, data]) => ({ id: key.split("/").at(-1), ref: { path: key }, data: () => data })),
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
    if (name === "../focus/activity") return activityModule.exports;
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

test("quiz queue includes previously saved Bio Radar descriptions and remains account scoped", async () => {
  const db = createFirestore();
  await db.createScanHistory("user-a", { source: "camera", engine: "gemini-v1", title: "Oak", summary: "A saved estimate.", includeInDailyQuizzes: false });
  await db.createScanHistory("user-a", { source: "camera", engine: "gemini-v1", title: "No summary", includeInDailyQuizzes: false });
  await db.createScanHistory("user-b", { source: "camera", engine: "gemini-v1", title: "Other", summary: "Another account." });
  const queue = await db.getQuizQueue("user-a");
  assert.equal(queue.length, 1);
  assert.equal(queue[0].title, "Oak");
  assert.equal(queue[0].summary, "A saved estimate.");
  assert.equal((await db.getQuizQueue("user-b")).length, 1);
  const questionId = `scan-discovery-2026-11-10-${queue[0].scanId}`;
  await db.createQuizHistory("user-a", { questionId, prompt: "What was saved?", correct: true });
  assert.deepEqual(await db.getAnsweredQuizQuestionIds("user-a"), [questionId]);
  assert.deepEqual(await db.getAnsweredQuizQuestionIds("user-b"), []);
});

test("rolling challenge anchor persists per account and is never reset by progress", async () => {
  const db = createFirestore();
  assert.equal(await db.getOrCreateChallengeAnchor("user-a", 1000), 1000);
  assert.equal(await db.getOrCreateChallengeAnchor("user-a", 5000), 1000);
  assert.equal(await db.getOrCreateChallengeAnchor("user-b", 5000), 5000);
  await db.saveChallengeProgress("user-a", "daily-window-1000-0", { status: "completed", completedAt: new Date() });
  assert.equal(await db.getOrCreateChallengeAnchor("user-a", 9000), 1000);
  assert.equal((await db.getChallengeProgress("user-a", "daily-window-1000-0")).status, "completed");
  assert.equal(await db.getChallengeProgress("user-a", "daily-window-1000-1"), null);
  await db.deleteChallengeProgress("user-a", "daily-window-1000-0");
  assert.equal(await db.getOrCreateChallengeAnchor("user-a", 9000), 1000);
});

test("invalid saved challenge anchor is reported, not replaced", async () => {
  const db = createFirestore();
  await db.saveChallengeProgress("user-a", "daily-rolling-anchor", {
    status: "available",
    metadata: { anchorMillis: "invalid" },
  });
  await assert.rejects(db.getOrCreateChallengeAnchor("user-a", 1000), /invalid/);
  assert.equal((await db.getChallengeProgress("user-a", "daily-rolling-anchor")).metadata.anchorMillis, "invalid");
});

test("completed challenge listing is account scoped and excludes incomplete progress", async () => {
  const db = createFirestore();
  await db.saveChallengeProgress("user-a", "daily-window-1000-0", { status: "completed", completedAt: new Date(), metadata: { challenge: "Saved prompt" } });
  await db.saveChallengeProgress("user-a", "daily-window-1000-1", { status: "started" });
  await db.saveChallengeProgress("user-b", "daily-window-1000-0", { status: "completed", completedAt: new Date() });
  const history = await db.listCompletedChallenges("user-a");
  assert.equal(history.length, 1);
  assert.equal(history[0].challengeId, "daily-window-1000-0");
  assert.equal(history[0].metadata.challenge, "Saved prompt");
  await db.deleteChallengeProgress("user-a", "daily-window-1000-0");
  assert.deepEqual(await db.listCompletedChallenges("user-a"), []);
});
