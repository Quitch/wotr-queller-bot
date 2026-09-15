// Colour contrast of the design tokens (src/styles/tokens.css, both themes) and the flowchart strokes
// (src/modals/flow/svg.js): text tokens at 7:1 (WCAG 1.4.6) and border, focus and stroke tokens at 3:1 (1.4.11) on the
// backgrounds they are used on, with sRGB relative luminance as WCAG defines it. Exit 1 on any failure.
// docs/wcag-2.2.md carries the resulting ratios; run with --table to print them all.
import fs from "node:fs";
import path from "node:path";
import * as fakeWindow from "./load.js";

const TEXT_MIN = 7; // 1.4.6 Contrast (Enhanced)
const GRAPHIC_MIN = 3; // 1.4.11 Non-text Contrast
const WHITE = "#ffffff";
const TOKENS_PATH = path.join(
  import.meta.dirname,
  "..",
  "src/styles/tokens.css",
);
// Which token is drawn on which backgrounds (text at 7:1, the rest at 3:1).
const PAIRS = [
  { text: true, fg: "--ink", bg: ["--bg", "--surface", "--surface2"] },
  { text: true, fg: "--muted", bg: ["--bg", "--surface", "--surface2"] },
  { text: true, fg: "--accent", bg: ["--bg", "--surface"] },
  { text: true, fg: "--accent-ink", bg: ["--accent"] },
  { text: true, fg: "--bad", bg: ["--bg", "--surface"] },
  { text: true, fg: "--warn", bg: ["--bg", "--surface"] },
  { text: true, fg: "--ok", bg: ["--bg", "--surface"] },
  {
    text: true,
    fg: "--node-ink",
    bg: ["--nS", "--nA", "--nD", "--nd", "--nJ", "--nP", "--nT"],
  },
  { text: false, fg: "--line2", bg: ["--bg", "--surface", "--surface2"] },
  { text: false, fg: "--focus", bg: ["--bg", "--surface"] },
  { text: false, fg: "--gold", bg: ["--bg", "--surface"] },
  { text: false, fg: "--nSs", bg: ["--surface"] },
  { text: false, fg: "--nAs", bg: ["--surface"] },
  { text: false, fg: "--nDs", bg: ["--surface"] },
  { text: false, fg: "--nds", bg: ["--surface"] },
  { text: false, fg: "--nJs", bg: ["--surface"] },
  { text: false, fg: "--nPs", bg: ["--surface"] },
  { text: false, fg: "--nTs", bg: ["--surface"] },
];
// Fixed colours outside the tokens: the error bar (styles/errbar.css) and the tooltip (ink on bg, checked above).
const FIXED = [
  { what: "error bar text", fg: "#fff7f2", bg: "#7e2419", min: TEXT_MIN },
];
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.log("FAIL", message);
  } else console.log("ok  ", message);
};

function channels(hex) {
  let digits = hex.replace("#", "");
  if (digits.length === 3)
    digits = [...digits].map((digit) => digit + digit).join("");
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255);
}
const linear = (channel) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
function luminance(hex) {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
// The hex tokens of each theme block in tokens.css: {light: {--ink: "#…"}, dark: {…}}.
function readThemes() {
  const css = fs.readFileSync(TOKENS_PATH, "utf8");
  const blocks = {};
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().split("\n").pop().trim();
    const theme = selector === ":root" ? "light" : "dark";
    blocks[theme] ||= {};
    for (const token of match[2].matchAll(
      /(--[\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi,
    ))
      blocks[theme][token[1]] = token[2].toLowerCase();
  }
  return blocks;
}
function checkTheme(theme, tokens, table) {
  for (const { text, fg, bg: backgrounds } of PAIRS) {
    for (const bg of backgrounds) {
      const min = text ? TEXT_MIN : GRAPHIC_MIN;
      if (!tokens[fg] || !tokens[bg]) {
        ok(false, theme + ": " + fg + " or " + bg + " is not a hex token");
        continue;
      }
      const ratio = contrast(tokens[fg], tokens[bg]);
      table.push([theme, fg, bg, tokens[fg], tokens[bg], ratio, min]);
      ok(
        ratio >= min,
        theme +
          ": " +
          fg +
          " on " +
          bg +
          " " +
          ratio.toFixed(2) +
          ":1 (needs " +
          min +
          ":1)",
      );
    }
  }
}
function checkStrokes(table) {
  const kinds = fakeWindow.QB_NODE_KIND;
  for (const [name, code] of Object.entries(kinds)) {
    const stroke = fakeWindow.NODE_STYLE[code]?.stroke;
    if (!stroke) continue;
    const ratio = contrast(stroke, WHITE);
    table.push([
      "svg",
      name + " stroke",
      "white",
      stroke,
      WHITE,
      ratio,
      GRAPHIC_MIN,
    ]);
    ok(
      ratio >= GRAPHIC_MIN,
      "flowchart " +
        name +
        " stroke " +
        stroke +
        " on white " +
        ratio.toFixed(2) +
        ":1",
    );
  }
  for (const name of ["HATCH", "GROUP_STROKE", "ARROW", "CURRENT_OUTLINE"]) {
    const colour = fakeWindow.SVG_COLOUR[name];
    const ratio = contrast(colour, WHITE);
    table.push(["svg", name, "white", colour, WHITE, ratio, GRAPHIC_MIN]);
    ok(
      ratio >= GRAPHIC_MIN,
      "flowchart " +
        name +
        " " +
        colour +
        " on white " +
        ratio.toFixed(2) +
        ":1",
    );
  }
  for (const name of ["TEXT", "LABEL_TEXT", "GROUP_TEXT"]) {
    const colour = fakeWindow.SVG_COLOUR[name];
    const ratio = contrast(colour, WHITE);
    table.push(["svg", name, "white", colour, WHITE, ratio, TEXT_MIN]);
    ok(
      ratio >= TEXT_MIN,
      "flowchart " +
        name +
        " " +
        colour +
        " on white " +
        ratio.toFixed(2) +
        ":1",
    );
  }
}
function checkFixed(table) {
  for (const { what, fg, bg, min } of FIXED) {
    const ratio = contrast(fg, bg);
    table.push(["fixed", what, "", fg, bg, ratio, min]);
    ok(
      ratio >= min,
      what + " " + fg + " on " + bg + " " + ratio.toFixed(2) + ":1",
    );
  }
}
function printTable(table) {
  console.log("\n| Theme | Foreground | Background | Values | Ratio | Needs |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const [theme, fg, bg, fgHex, bgHex, ratio, min] of table)
    console.log(
      "| " +
        [
          theme,
          fg,
          bg,
          fgHex + " on " + bgHex,
          ratio.toFixed(2) + ":1",
          min + ":1",
        ].join(" | ") +
        " |",
    );
}
function main() {
  const themes = readThemes();
  const table = [];
  ok(
    themes.light && themes.dark && Object.keys(themes.light).length > 20,
    "tokens.css parsed: " +
      Object.keys(themes.light || {}).length +
      " light and " +
      Object.keys(themes.dark || {}).length +
      " dark hex tokens",
  );
  checkTheme("light", themes.light, table);
  checkTheme("dark", themes.dark, table);
  checkStrokes(table);
  checkFixed(table);
  if (process.argv.includes("--table")) printTable(table);
  console.log(fails ? fails + " failure(s)" : "all contrast checks passed");
  process.exit(fails ? 1 : 0);
}
main();
