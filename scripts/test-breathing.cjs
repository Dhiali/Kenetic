const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "breathing.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { getBreathPhase } = mod.exports;

test("recenter follows a 4-7-8 cycle", () => {
  for (const [time, name, remaining] of [[0, "inhale", 4], [4, "hold", 7], [11, "exhale", 8], [19, "inhale", 4]]) {
    const phase = getBreathPhase("recenter", time);
    assert.equal(phase.name, name);
    assert.equal(phase.remainingSeconds, remaining);
  }
});

test("box breathing has four four-second phases", () => {
  assert.deepEqual([0, 4, 8, 12, 16].map((time) => getBreathPhase("clear-mind", time).name),
    ["inhale", "hold after inhale", "exhale", "hold after exhale", "inhale"]);
  assert.equal(getBreathPhase("clear-mind", 6).remainingSeconds, 2);
});

test("physiological sigh includes a second inhale before exhaling", () => {
  assert.deepEqual([0, 4, 5, 11, 13].map((time) => getBreathPhase("calm-down", time).name),
    ["inhale", "second inhale", "exhale", "rest", "inhale"]);
  assert.notEqual(getBreathPhase("calm-down", 0).key, getBreathPhase("calm-down", 13).key);
});
