const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "outdoors", "dailyChallenge.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { challengeWindow, CHALLENGE_WINDOW_MS, challengeFromId, completedChallengeHistory, formatChallengeCountdown } = mod.exports;

test("challenge changes exactly 24 hours after opening, regardless of completion", () => {
  const anchor = new Date("2026-11-10T12:15:00Z").getTime();
  const first = challengeWindow(anchor, anchor);
  assert.deepEqual(challengeWindow(anchor, anchor + CHALLENGE_WINDOW_MS - 1), first);
  const next = challengeWindow(anchor, anchor + CHALLENGE_WINDOW_MS);
  assert.notEqual(next.id, first.id);
  assert.notEqual(next.challenge, first.challenge);
  assert.equal(next.endsAt, anchor + 2 * CHALLENGE_WINDOW_MS);
  const later = challengeWindow(anchor, anchor + 10 * CHALLENGE_WINDOW_MS);
  assert.equal(later.endsAt, anchor + 11 * CHALLENGE_WINDOW_MS);
});

test("invalid saved schedules and clock rollback fail explicitly", () => {
  assert.throws(() => challengeWindow(NaN, 1), /invalid/);
  assert.throws(() => challengeWindow(1000, 999), /invalid/);
});

test("countdown rounds up and reaches zero at the window boundary", () => {
  const end = 100000000;
  assert.equal(formatChallengeCountdown(end, end - CHALLENGE_WINDOW_MS), "24:00:00");
  assert.equal(formatChallengeCountdown(end, end - 61001), "00:01:02");
  assert.equal(formatChallengeCountdown(end, end - 1), "00:00:01");
  assert.equal(formatChallengeCountdown(end, end), "00:00:00");
  assert.equal(formatChallengeCountdown(end, end + 1000), "00:00:00");
});

test("history reconstructs rolling and legacy challenges, sorts, and ignores unrelated records", () => {
  const anchor = Date.parse("2026-11-10T12:15:00Z");
  const first = challengeWindow(anchor, anchor);
  const next = challengeWindow(anchor, anchor + CHALLENGE_WINDOW_MS);
  assert.equal(challengeFromId(first.id), first.challenge);
  assert.equal(challengeFromId(next.id), next.challenge);
  assert.equal(challengeFromId("daily-2026-11-10"), first.challenge);
  assert.equal(challengeFromId("daily-2026-02-31"), null);
  assert.equal(challengeFromId("daily-window-999999999999999999-1"), null);
  const history = completedChallengeHistory([
    { challengeId: first.id, completedAt: { toMillis: () => 1000 } },
    { challengeId: next.id, completedAt: new Date(2000), metadata: { challenge: "Original saved prompt" } },
    { challengeId: "daily-2026-11-10" },
    { challengeId: "another-feature", completedAt: new Date(3000) },
  ]);
  assert.deepEqual(history.map((item) => item.id), [next.id, first.id, "daily-2026-11-10"]);
  assert.equal(history[0].challenge, "Original saved prompt");
  assert.equal(history[2].completedAt, null);
});
