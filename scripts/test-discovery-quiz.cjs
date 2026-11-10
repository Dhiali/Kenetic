const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "outdoors", "discoveryQuiz.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { getDiscoveryQuizItems } = mod.exports;
const today = new Date("2026-11-10T12:00:00Z");
const discoveries = [
  { scanId: "a", title: "Oak", summary: "First saved estimate." },
  { scanId: "b", title: "Robin", summary: "Second saved estimate." },
  { scanId: "c", title: "oak", summary: "Duplicate name." },
];

test("questions recall real saved descriptions without inventing facts", () => {
  const items = getDiscoveryQuizItems(discoveries, today, []);
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.options[item.correctIndex], item.fact);
    assert.ok(discoveries.some((discovery) => discovery.summary === item.fact));
    assert.ok(item.prompt.includes(item.title));
  }
  assert.equal(items[0].options.includes("Second saved estimate."), true);
});

test("a single discovery is usable and answered questions return the next UTC day", () => {
  const [item] = getDiscoveryQuizItems(discoveries.slice(0, 1), today, []);
  assert.equal(item.options.length, 2);
  assert.equal(item.options[item.correctIndex], "First saved estimate.");
  assert.deepEqual(getDiscoveryQuizItems(discoveries.slice(0, 1), today, [`scan-${item.scanId}`]), []);
  assert.equal(getDiscoveryQuizItems(discoveries.slice(0, 1), new Date("2026-11-11T00:00:00Z"), [`scan-${item.scanId}`]).length, 1);
});

test("invalid and duplicate discoveries are filtered and the queue is capped", () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({ scanId: String(index), title: `Title ${index}`, summary: `Description ${index}` }));
  assert.equal(getDiscoveryQuizItems([{ scanId: "x", title: "", summary: "Text" }, ...entries], today, []).length, 5);
  assert.deepEqual(getDiscoveryQuizItems([{ scanId: "x", title: "Name", summary: "  " }], today, []), []);
});
