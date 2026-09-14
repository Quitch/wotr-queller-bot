// Loads the engine and walker (no DOM) from ../src into a fake window and returns it.
const fs = require("node:fs"),
  path = require("node:path");
module.exports = function load() {
  const window = {};
  global.window = window;
  for (const file of [
    "flow.js",
    "anchors.js",
    "cards.js",
    "ref.js",
    "engine.js",
    "walk.js",
    "debug.js",
  ])
    new Function(
      "window",
      fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"),
    )(window);
  return window;
};
