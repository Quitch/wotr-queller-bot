// Loads the engine and walker (no DOM) from ../src into a fake window and returns it.
const fs = require("fs"),
  path = require("path");
module.exports = function load() {
  const window = {};
  global.window = window;
  for (const f of [
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
      fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8"),
    )(window);
  return window;
};
