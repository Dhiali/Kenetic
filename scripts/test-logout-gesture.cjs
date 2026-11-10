const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

test("compiled logout gesture captures an initialized JavaScript callback", () => {
  const filename = path.join(__dirname, "..", "src", "screens", "ProfileScreen.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = babel.transformSync(source, { filename }).code;
  const callback = compiled.search(/\bvar logout\s*=\s*function/);
  const call = compiled.lastIndexOf("runOnJS(logout)()");
  const capture = compiled.indexOf(",logout]))", call);
  assert.ok(callback >= 0, "Logout callback should be present in the compiled component");
  assert.ok(call >= 0 && capture > call, "Logout gesture should capture the callback");
  assert.ok(callback < capture, "Logout callback must be initialized before the gesture captures it");
});
