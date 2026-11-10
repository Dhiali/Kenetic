const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "activity.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { recentFocusActivity, formatFocusTime } = mod.exports;

const at = (date, overrides = {}) => ({
  type: "focus",
  status: "completed",
  completedAt: { toMillis: () => date.getTime() },
  durationSeconds: 60,
  ...overrides,
});

test("recent activity uses seven local calendar days and only completed focus sessions", () => {
  const now = new Date(2026, 10, 10, 12);
  const sessions = [
    at(new Date(2026, 10, 10, 9), { durationSeconds: 42 }),
    at(new Date(2026, 10, 10, 10)),
    at(new Date(2026, 10, 4, 0)),
    at(new Date(2026, 10, 3, 23, 59)),
    at(new Date(2026, 10, 10, 13)),
    at(new Date(2026, 10, 9), { status: "abandoned" }),
    at(new Date(2026, 10, 9), { type: "breathe" }),
    at(new Date(2026, 10, 9), { completedAt: null }),
  ];
  assert.deepEqual(recentFocusActivity(sessions, now), { sessionsCompleted: 3, activeDays: 2, seconds: 162 });
});

test("formatting keeps short sessions visible and formats hours", () => {
  assert.equal(formatFocusTime(0), "0m");
  assert.equal(formatFocusTime(12), "12s");
  assert.equal(formatFocusTime(125), "2m");
  assert.equal(formatFocusTime(3600), "1h");
  assert.equal(formatFocusTime(3720), "1h 2m");
});
