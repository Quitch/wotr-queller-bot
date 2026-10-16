// Bundle the sources into the single-file artifact (index.html). The Artifact host wraps the file in its own
// <!doctype>/<head>/<body>, so the page starts at <title>. esbuild follows the imports from src/main.js and the
// @imports from the stylesheet; the script is a plain IIFE, minified with function and class names kept so that stack
// traces in the debug log still name the function that threw.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const ROOT = import.meta.dirname;
const OUT = path.join(ROOT, "index.html");
// The two web fonts, in the weights the stylesheet uses (styles/tokens.css: display 600 and 700, body 400, 600 and
// italic 400); the monospace text uses the system stack.
const HEAD = `<title>Queller Bot Runner</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap">
`;

// One bundle's text; esbuild reports its own errors and warnings.
async function bundle(entry, options) {
  const result = await build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    write: false,
    charset: "utf8",
    logLevel: "warning",
    minify: true,
    ...options,
  });
  return result.outputFiles[0].text;
}
// The whole page: fonts, the stylesheet, the app root, then the script with the build time and commit defined into it.
async function buildPage(builtAt, commit) {
  const css = await bundle("src/styles/index.css");
  const js = await bundle("src/main.js", {
    format: "iife",
    keepNames: true,
    define: {
      QB_BUILT: JSON.stringify(builtAt),
      QB_COMMIT: JSON.stringify(commit),
    }, // shown in the debug log
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

// The short hash of HEAD, with "-dirty" when a tracked file differs from it (untracked files are left out, as
// git describe --dirty does); null outside a git checkout or without git.
function commitStamp() {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  try {
    const hash = git("rev-parse", "--short", "HEAD");
    const dirty = git("status", "--porcelain", "--untracked-files=no");
    return hash + (dirty ? "-dirty" : "");
  } catch {
    return null;
  }
}

const builtAt = new Date().toISOString().slice(0, 16) + "Z"; // YYYY-MM-DDTHH:MMZ
const commit = commitStamp();
const page = await buildPage(builtAt, commit);
writeFileSync(OUT, page, "utf8");
console.log(
  "index.html:",
  Buffer.byteLength(page),
  "bytes, commit",
  commit ?? "unknown",
);
