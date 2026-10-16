// Every language defines the same texts (SPEC §5). Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../js/strings.js");
const STRINGS = window.STRINGS;

test("languages are listed as EN, EU, ES", () => {
  assert.deepEqual(Object.keys(STRINGS), ["en", "eu", "es"]);
});

test("every language has the same keys, of the same kind", () => {
  const ref = STRINGS.en;
  for (const [code, texts] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(texts).sort(), Object.keys(ref).sort(), `${code} keys differ from en`);
    for (const k in ref) {
      assert.equal(typeof texts[k], typeof ref[k], `${code}.${k} is a ${typeof texts[k]}, en.${k} is a ${typeof ref[k]}`);
      if (typeof ref[k] === "string") assert.ok(texts[k].trim(), `${code}.${k} is empty`);
    }
  }
});
