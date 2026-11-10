const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "alienPlan.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { parseAlienPlan, alienElapsedSeconds } = mod.exports;

const plan = {
  task: "A task",
  prompt: "Start small",
  steps: ["First", "Second"],
  index: 0,
  durationSeconds: 300,
  status: "active",
};

test("saved plans preserve the step and enforce the 1–10 minute limit", () => {
  for (const seconds of [60, 300, 600]) {
    assert.deepEqual(parseAlienPlan(JSON.stringify({ ...plan, durationSeconds: seconds })), { ...plan, durationSeconds: seconds });
  }
  for (const seconds of [0, 59, 61, 601, 1800]) {
    assert.throws(() => parseAlienPlan(JSON.stringify({ ...plan, durationSeconds: seconds })), /invalid/);
  }
  for (const changes of [{ index: 2 }, { steps: [] }, { steps: [""] }, { status: "unknown" }]) {
    assert.throws(() => parseAlienPlan(JSON.stringify({ ...plan, ...changes })), /invalid/);
  }
  assert.equal(parseAlienPlan(JSON.stringify({ ...plan, index: 1, status: "complete" })).steps[1], "Second");
});

test("early completion records elapsed time and clamps at the session bounds", () => {
  const deadline = 300000;
  assert.equal(alienElapsedSeconds(deadline, 300, -1000), 0);
  assert.equal(alienElapsedSeconds(deadline, 300, 125500), 125);
  assert.equal(alienElapsedSeconds(deadline, 300, 300000), 300);
  assert.equal(alienElapsedSeconds(deadline, 300, 400000), 300);
});
