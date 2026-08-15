/* global __dirname */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("native screens that render wallet secrets prevent capture while mounted", () => {
  const packageJson = JSON.parse(read("package.json"));
  const phraseView = read("src/components/screens/phrase-view.tsx");
  const revealView = read("src/components/screens/reveal-secret-view.tsx");

  assert.equal(
    typeof packageJson.dependencies?.["expo-screen-capture"],
    "string",
    "the SDK-compatible screen-capture protection module is not installed",
  );

  for (const [name, source] of [
    ["PhraseView", phraseView],
    ["RevealSecretView", revealView],
  ]) {
    assert.match(
      source,
      /usePreventScreenCapture\s*\(/u,
      `${name} renders wallet credentials without mounting capture prevention`,
    );
  }
});
