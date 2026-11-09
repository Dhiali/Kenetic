const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "timing.ts"), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", javascript)(mod, mod.exports);
const { focusRemainingSeconds, shouldStartFocus } = mod.exports;

test("music handoff starts only after successful launch, background and return", () => {
  assert.equal(shouldStartFocus(false, true, "active"), false);
  assert.equal(shouldStartFocus(true, false, "active"), false);
  assert.equal(shouldStartFocus(true, true, "background"), false);
  assert.equal(shouldStartFocus(true, true, "inactive"), false);
  assert.equal(shouldStartFocus(true, true, "active"), true);
});

test("focus countdown uses the deadline, including after an app restart", () => {
  const start = 1_000_000;
  const deadline = start + 25 * 60_000;
  assert.equal(focusRemainingSeconds(deadline, start), 1500);
  assert.equal(focusRemainingSeconds(deadline, start + 120_001), 1380);
  assert.equal(focusRemainingSeconds(deadline, deadline - 1), 1);
  assert.equal(focusRemainingSeconds(deadline, deadline), 0);
  assert.equal(focusRemainingSeconds(deadline, deadline + 60_000), 0);
});
