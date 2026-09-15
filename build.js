// Bundle the sources into the single-file artifact (index.html). The Artifact host wraps the file in its own
// <!doctype>/<head>/<body>, so the page starts at <title>. esbuild follows the imports from src/main.js and the
// @imports from the stylesheet; the script is a plain IIFE, unminified so that stack traces in the debug log keep their
// names.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const ROOT = import.meta.dirname;
const OUT = path.join(ROOT, "index.html");
const HEAD = `<title>Queller Bot Runner</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
`;

// One bundle's text; esbuild reports its own errors and warnings.
async function bundle(entry, options) {
  const result = await build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    write: false,
    charset: "utf8",
    logLevel: "warning",
    ...options,
  });
  return result.outputFiles[0].text;
}
// The whole page: fonts, the stylesheet, the app root, then the script with the build time defined into it.
async function buildPage(builtAt) {
  const css = await bundle("src/styles.css");
  const js = await bundle("src/main.js", {
    format: "iife",
    define: { QB_BUILT: JSON.stringify(builtAt) }, // shown in the debug log
  });
  return (
    HEAD +
    "<style>\n" +
    css +
    "</style>\n" +
    '<div class="wrap" id="app"></div>\n' +
    "<script>\n" +
    js +
    "</script>\n"
  );
}

const builtAt = new Date().toISOString().slice(0, 16) + "Z"; // YYYY-MM-DDTHH:MMZ
const page = await buildPage(builtAt);
writeFileSync(OUT, page, "utf8");
console.log("index.html:", Buffer.byteLength(page), "bytes");
