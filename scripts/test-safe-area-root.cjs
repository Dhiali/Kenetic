const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

test("the app renders its screens inside the safe-area provider", () => {
  const file = path.join(__dirname, "..", "App.tsx");
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let providerImport = false;
  let screenInsideProvider = false;

  function visit(node, insideProvider = false) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === "react-native-safe-area-context") {
      const bindings = node.importClause?.namedBindings;
      providerImport = !!bindings && ts.isNamedImports(bindings) &&
        bindings.elements.some((item) => item.name.text === "SafeAreaProvider");
    }
    if (insideProvider && ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === "renderScreen") screenInsideProvider = true;
    const isProvider = ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "SafeAreaProvider";
    ts.forEachChild(node, (child) => visit(child, insideProvider || isProvider));
  }
  visit(source);
  assert.ok(providerImport, "SafeAreaProvider must be imported");
  assert.ok(screenInsideProvider, "screens must be rendered inside SafeAreaProvider");
});
