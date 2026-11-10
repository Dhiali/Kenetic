const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const files = [
  "App.tsx",
  ...fs.readdirSync(path.join(root, "src", "screens"))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => path.join("src", "screens", name)),
  path.join("src", "components", "SwipeAction.tsx"),
  path.join("src", "components", "AiConsent.tsx"),
];
const visibleAttributes = new Set(["label", "title", "subtitle", "description", "placeholder", "hint", "accessibilityLabel", "accessibilityHint"]);
const continuations = new Set(["to scan", "min"]);

function findLowercaseStarts(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function check(node, value) {
    if (/^[\s(←→]*[a-z]/.test(value)) {
      findings.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${value.trim()}`);
    }
  }
  function checkValue(node) {
    if (ts.isConditionalExpression(node)) {
      checkValue(node.whenTrue);
      checkValue(node.whenFalse);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      check(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      if (node.head.text) check(node, node.head.text);
      else checkValue(node.templateSpans[0].expression);
    }
  }
  function visit(node) {
    if (ts.isJsxText(node) && !continuations.has(node.text.trim())) {
      const siblings = node.parent.children;
      const index = siblings ? siblings.indexOf(node) : -1;
      const hasPreviousContent = index >= 0 && siblings.slice(0, index).some((item) => !ts.isJsxText(item) || item.text.trim());
      if (!hasPreviousContent) check(node, node.text);
    }
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(source)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) check(node.initializer, node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) checkValue(node.initializer.expression);
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression) &&
        ts.isJsxElement(node.parent) && /(?:^|\.)Text$/.test(node.parent.openingElement.tagName.getText(source))) {
      const siblings = node.parent.children;
      const index = siblings.indexOf(node);
      const hasPreviousContent = siblings.slice(0, index).some((item) => !ts.isJsxText(item) || item.text.trim());
      if (!hasPreviousContent) checkValue(node.expression);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "textTransform" && ts.isStringLiteral(node.initializer) && node.initializer.text === "lowercase") {
      findings.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: lowercase text transform`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

test("capitalization check detects lowercase headings and action labels", () => {
  const findings = findLowercaseStarts("fixture.tsx", '<><Text>hello.</Text><Button label="start now" /><Button label={`${open ? "close" : "open"} menu`} /></>');
  assert.equal(findings.length, 4);
});

test("static app headings and visible labels start with capitals", () => {
  const findings = files.flatMap((file) => findLowercaseStarts(file, fs.readFileSync(path.join(root, file), "utf8")));
  assert.deepEqual(findings, []);
});

test("generated sentences are capitalized for display without changing stored text", () => {
  const source = fs.readFileSync(path.join(root, "src", "utils", "sentenceCase.ts"), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", javascript)(module, module.exports);
  const original = "  notice the leaf. look closer! what do you see?";
  assert.equal(module.exports.capitalizeSentenceStarts(original), "  Notice the leaf. Look closer! What do you see?");
  assert.equal(original, "  notice the leaf. look closer! what do you see?");
  assert.equal(module.exports.capitalizeSentenceStarts("Already correct. 42 things."), "Already correct. 42 things.");
});
