const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "sessionStorage.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { scopedSessionKey } = mod.exports;

test("saved sessions are isolated by account and exercise", () => {
  const first = scopedSessionKey("@kenetic/session", "user-a", "calm-down");
  assert.notEqual(first, scopedSessionKey("@kenetic/session", "user-b", "calm-down"));
  assert.notEqual(first, scopedSessionKey("@kenetic/session", "user-a", "recenter"));
  assert.notEqual(scopedSessionKey("@kenetic/session", "a/b"), scopedSessionKey("@kenetic/session", "a", "b"));
  assert.throws(() => scopedSessionKey("@kenetic/session", ""), /without an account/);
});

test("failed completion waits for an explicit retry and never runs concurrently", () => {
  const gateSource = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "focus", "completionGate.ts"), "utf8");
  const gateJs = ts.transpileModule(gateSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const gateModule = { exports: {} };
  new Function("module", "exports", gateJs)(gateModule, gateModule.exports);
  const gate = gateModule.exports.createCompletionGate();
  assert.equal(gate.start(), true);
  assert.equal(gate.start(), false);
  gate.fail();
  assert.equal(gate.start(), false);
  assert.equal(gate.start(), false);
  assert.equal(gate.start(true), true);
  assert.equal(gate.start(true), false);
  gate.fail();
  assert.equal(gate.start(true), true);
});
