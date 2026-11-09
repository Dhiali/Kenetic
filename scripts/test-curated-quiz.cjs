const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "outdoors", "curatedQuiz.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { getCuratedQuizItems } = mod.exports;

test("curated questions are valid and available without discoveries", () => {
  const items = getCuratedQuizItems(new Date("2026-11-09T12:00:00Z"), []);
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.options.length, 3);
    assert.ok(item.correctIndex >= 0 && item.correctIndex < item.options.length);
    assert.ok(item.prompt && item.fact);
    assert.match(item.scanId, /^general-2026-11-09-/);
  }
});

test("answered questions stay completed for the UTC day and reset the next day", () => {
  const day = new Date("2026-11-09T12:00:00Z");
  const items = getCuratedQuizItems(day, []);
  const answered = items.map((item) => `scan-${item.scanId}`);
  assert.equal(getCuratedQuizItems(day, answered).length, 0);
  assert.equal(getCuratedQuizItems(new Date("2026-11-10T00:00:00Z"), answered).length, 3);
});
