import assert from "node:assert/strict";
import test from "node:test";
import worker, { callGemini, DailyQuota, validateInput } from "../ai-worker/src/index.mjs";

function quotaStorage() {
  const counts = new Map();
  const sql = { exec(query, uid) {
    if (query.startsWith("CREATE")) return {};
    if (query.startsWith("SELECT COALESCE")) return { one: () => ({ total: [...counts.values()].reduce((a, b) => a + b, 0) }) };
    if (query.startsWith("SELECT uses")) return { toArray: () => counts.has(uid) ? [{ uses: counts.get(uid) }] : [] };
    if (query.startsWith("INSERT")) { counts.set(uid, (counts.get(uid) || 0) + 1); return {}; }
    throw new Error(`Unexpected SQL ${query}`);
  } };
  return { sql, transactionSync: (callback) => callback() };
}

test("input requires explicit adult consent and validates media and task size", () => {
  assert.throws(() => validateInput({ kind: "task", task: "test", adult: true }), /Consent/);
  assert.throws(() => validateInput({ kind: "task", task: "x".repeat(1001), adult: true, consent: true }), /1000/);
  assert.throws(() => validateInput({ kind: "audio", mimeType: "audio/mp4", data: "a".repeat(20), adult: true, consent: true }), /Unknown request type/);
  assert.throws(() => validateInput({ kind: "photo", mimeType: "audio/mp4", data: "a".repeat(20), adult: true, consent: true }), /media/);
  assert.deepEqual(validateInput({ kind: "task", task: "  test ", adult: true, consent: true }), { kind: "task", task: "test" });
});

test("quota enforces exactly 10 per user and 100 total", async () => {
  const quota = new DailyQuota({ storage: quotaStorage() });
  const use = async (uid) => (await (await quota.fetch(new Request("https://quota/", { method: "POST", body: JSON.stringify({ uid }) }))).json()).allowed;
  for (let i = 0; i < 10; i++) assert.equal(await use("first"), true);
  assert.equal(await use("first"), false);
  for (let i = 1; i < 10; i++) {
    for (let j = 0; j < 10; j++) assert.equal(await use(`user-${i}`), true);
  }
  assert.equal(await use("new-user"), false);
});

test("photo requests require the complete nature schema and preserve uncertainty", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const expected = {
    name: "Unknown",
    scientificName: "Unknown",
    summary: "A possible plant is visible.",
    uncertainty: "The photo is too unclear to identify the species.",
  };
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(expected) }] },
      }],
    });
  };
  try {
    assert.deepEqual(await callGemini({ kind: "photo", mimeType: "image/jpeg", data: "test-media" }, "test-key"), expected);
    {
      const { contents, generationConfig } = calls[0];
      assert.equal(contents[0].parts[1].inline_data.mime_type, "image/jpeg");
      assert.equal(generationConfig.responseMimeType, "application/json");
      assert.deepEqual(generationConfig.responseJsonSchema.required, ["name", "scientificName", "summary", "uncertainty"]);
      assert.equal(generationConfig.maxOutputTokens, 2048);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("incomplete or interrupted nature responses fail explicitly", async () => {
  const originalFetch = globalThis.fetch;
  let candidate = {
    finishReason: "STOP",
    content: { parts: [{ text: JSON.stringify({ name: "Robin", summary: "A bird." }) }] },
  };
  globalThis.fetch = async () => Response.json({ candidates: [candidate] });
  const input = { kind: "photo", mimeType: "image/jpeg", data: "test-media" };
  try {
    await assert.rejects(callGemini(input, "test-key"), /incomplete nature result/);
    candidate = { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } };
    await assert.rejects(callGemini(input, "test-key"), /could not finish/);
    candidate = { finishReason: "STOP", content: { parts: [{ text: "{" }] } };
    await assert.rejects(callGemini(input, "test-key"), /unreadable result/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker verifies Firebase signatures and region before forwarding requests", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "test-key" };
  const base64url = (value) => Buffer.from(value).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  async function token(overrides = {}) {
    const header = base64url(JSON.stringify({ alg: "RS256", kid: "test-key" }));
    const payload = base64url(JSON.stringify({ aud: "test-project", iss: "https://securetoken.google.com/test-project", sub: "user-1", exp: now + 60, iat: now, auth_time: now, ...overrides }));
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${base64url(signature)}`;
  }
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://www.googleapis.com/")) return Response.json({ keys: [jwk] });
    if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
      upstreamCalls++;
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ steps: ["Open the document", "Write one sentence"] }) }] } }] });
    }
    throw new Error(`Unexpected network access: ${url}`);
  };
  try {
    const quota = new DailyQuota({ storage: quotaStorage() });
    const env = {
      FIREBASE_PROJECT_ID: "test-project", GEMINI_API_KEY: "test-only", ALLOWED_COUNTRIES: "ZA",
      QUOTA: { idFromName: (name) => name, get: () => ({ fetch: (url, init) => quota.fetch(new Request(url, init)) }) },
    };
    function request(jwt, country, body = { kind: "task", task: "write", adult: true, consent: true }) {
      const result = new Request("https://worker.example/v1/analyze", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body) });
      result.cf = { country };
      return result;
    }
    const good = await token();
    assert.equal((await worker.fetch(request(good, "GB"), env)).status, 403);
    assert.equal((await worker.fetch(request(good, "US"), env)).status, 403);
    assert.equal((await worker.fetch(request(await token({ aud: "wrong" }), "ZA"), env)).status, 401);
    assert.equal((await worker.fetch(request(`${good.slice(0, -5)}abcde`, "ZA"), env)).status, 401);
    assert.equal((await worker.fetch(request(good, "ZA", { kind: "task", task: "write" }), env)).status, 400);
    assert.equal(upstreamCalls, 0);
    for (let i = 0; i < 10; i++) {
      const res = await worker.fetch(request(good, "ZA"), env);
      assert.equal(res.status, 200);
      assert.deepEqual((await res.json()).steps, ["Open the document", "Write one sentence"]);
    }
    assert.equal((await worker.fetch(request(good, "ZA"), env)).status, 429);
    assert.equal(upstreamCalls, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
