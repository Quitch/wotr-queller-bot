// Loads the engine and walker (no DOM) from ../src into a fake window and returns it.
const fs = require("node:fs"),
  path = require("node:path");
// The scripts a test needs, in dependency order: everything build.py concatenates except the two DOM scripts
// (ui.js, modals.js). Mirrors SOURCE_ORDER in build.py; keep the two lists in step.
const ENGINE_SOURCES = [
  "flow.js",
  "anchors.js",
  "cards.js",
  "ref.js",
  "engine.js",
  "walk.js",
  "debug.js",
];
module.exports = function load() {
  const window = {};
  global.window = window;
  for (const file of ENGINE_SOURCES)
    new Function(
      "window",
      fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"),
    )(window);
  return window;
};
