const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "ai", file), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", javascript)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

test("agreement is versioned, account-scoped, revocable and fails closed", async () => {
  const profiles = { alice: {}, bob: {} };
  let current = "alice";
  let unavailable = false;
  const api = load("consent.ts", {
    "../firebase/auth": { ensureAnonymousUser: async () => ({ uid: current }) },
    "../firebase/firestore": { userReference: (uid) => uid },
    "firebase/firestore": {
      getDocFromServer: async (uid) => {
        if (unavailable) throw new Error("offline");
        return { exists: () => Boolean(profiles[uid]), data: () => profiles[uid] };
      },
      updateDoc: async (uid, values) => Object.assign(profiles[uid], values),
      serverTimestamp: () => "timestamp",
    },
  });
  assert.equal(await api.loadAiConsent(), false);
  await api.setAiConsent(true);
  assert.equal(await api.loadAiConsent(), true);
  current = "bob";
  assert.equal(await api.loadAiConsent(), false);
  current = "alice";
  await api.setAiConsent(false);
  assert.equal(await api.loadAiConsent(), false);
  profiles.alice.aiConsentVersion = "outdated";
  assert.equal(await api.loadAiConsent(), false);
  unavailable = true;
  await assert.rejects(api.loadAiConsent(), /offline/);
});

test("AI requests never send task or photo without current agreement", async () => {
  let agreed = false;
  let calls = 0;
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
  process.env.EXPO_PUBLIC_AI_SERVICE_URL = "https://example.test";
  global.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ steps: ["First", "Second"] }) };
  };
  try {
    const api = load("client.ts", {
      "expo-file-system": { File: class { exists = true; size = 10; async base64() { return "photo"; } } },
      "../firebase/auth": { ensureAnonymousUser: async () => ({ uid: "alice", getIdToken: async () => "token" }) },
      "./consent": { hasAiConsent: async (uid) => { assert.equal(uid, "alice"); return agreed; } },
    });
    await assert.rejects(api.makeTaskSteps("Task"), /agreement is required/i);
    await assert.rejects(api.analyzeNature("photo"), /agreement is required/i);
    assert.equal(calls, 0);
    agreed = true;
    assert.deepEqual(await api.makeTaskSteps("Task"), { steps: ["First", "Second"] });
    assert.equal(calls, 1);
    agreed = false;
    await assert.rejects(api.makeTaskSteps("Task"), /agreement is required/i);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_AI_SERVICE_URL;
    else process.env.EXPO_PUBLIC_AI_SERVICE_URL = originalUrl;
  }
});
