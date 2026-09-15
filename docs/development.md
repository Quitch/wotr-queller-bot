# Development

How to set the project up, what each npm script does, how the build and the CI workflow work, and the conventions the code follows. [architecture.md](architecture.md) describes how the code is organised; [testing.md](testing.md) describes what each test checks and what the suite cannot see.

## Setup

Node 24 (the version CI runs), then `npm ci`. The browser tests need a Chromium for Playwright once: `npx playwright install chromium`. The optional NVDA screen-reader check has its own one-time setup, described in [testing.md](testing.md).

## Scripts

```text
npm run build           # bundle src/ into index.html (esbuild, minified with names kept; defines QB_BUILT with the UTC build time)
npm run anchors         # regenerate src/flow/anchors.json from the draw.io flowchart (--check reports whether it is up to date)
npm run verify          # all linters + all Node tests; run before committing
npm run lint            # eslint + stylelint + markdownlint + prettier --check
npm run format          # prettier --write .
npm test                # check.js, verify.js, debuglog.js, render.js, ui.js, contrast.js, fuzz.js 1
npm run coverage        # npm test under c8: a text report plus coverage/lcov.info (what SonarQube Cloud reads); src files no test imports count as 0%
npm run smoke           # the Playwright browser test of the built index.html (build first)
npm run a11y            # the Playwright accessibility checks of the built index.html: keyboard, live region, colour scheme, scroll chaining, touch (build first)
npm run reader          # the optional NVDA screen-reader check (Windows, headed, never in CI; skips when NVDA cannot run)
```

Two scripts run by hand only:

```text
node test/fuzz.js 7            # 400 random games with seed 7 across all 16 setting combinations; any seed works
node test/fuzz.js 7 --digest   # also prints a sha256 of every final state: a refactor that preserves behaviour leaves it unchanged
node test/shot.js              # Playwright screenshots to test/shot-*.png, desktop plus phone portrait and landscape (build first)
```

Any test can be run on its own with `node test/<name>.js`.

## How the tests are built

The tests are plain Node scripts with no test runner; each exits 1 on failure. The Node tests never touch the DOM: `test/load.js` is the one place they reach into `src/`, and every module under `ui/` and `modals/` imports without a DOM, so `test/render.js` builds the whole page and every modal's content in Node. Only the DOM wiring is left to the Playwright scripts, which `test/browser.js` serves the built page to. `test/play.js` is the random game driver `fuzz.js` and `render.js` share: a seeded `Math.random`, a random answer to every prompt, and hooks around every answer (`onWalkStart`, `onPrompt`, `afterAnswer`, `afterPhase`) for a test's own checks.

A behaviour fix gets a scripted scenario in `test/verify.js`: a named function listed in `SCENARIOS`, typically `phase5State()` plus `driveWalk()` with `[pattern, answer]` rules that answer prompts by regex until the walk finishes. The fuzz test is the safety net for exceptions, walks left without a prompt and card-count conservation, and its `--digest` shows whether a change altered any game's outcome.

## The build

`build.js` bundles `src/` with esbuild: it follows the imports from `src/main.js` and the `@import`s from `src/styles/index.css` and writes one stylesheet and one classic script (an IIFE, minified with function and class names kept so that stack traces in the debug log still name the function that threw) into `index.html`. `QB_BUILT` is defined into the script as the UTC build time; the debug log shows it. The page is published as a Claude Artifact, whose host adds the doctype, head and body, so the file is a body fragment that starts at `<title>`; it loads its two web fonts from Google Fonts. `index.html` is not tracked. `test/browser.js` wraps the fragment in a document with a UTF-8 charset to serve it to the Playwright scripts.

## Continuous integration

The `Verify` workflow (`.github/workflows/verify.yml`) runs on every push to `main` and every pull request, in two jobs:

- **Lint, test, build, Sonar**: `npm run lint`, `npm run coverage`, `npm run build`, then a SonarQube Cloud scan when the `SONAR_TOKEN` repository secret is present (a fork's pull request has none; the rest of the job still verifies it). CI-based analysis is configured in `sonar-project.properties`; Sonar reads `coverage/lcov.info`, so its coverage figure is the Node-side coverage only. The modules that only run in a browser (`main.js`, `ui/boot.js`, `ui/wire.js`, `ui/tooltip.js`, `modals/framework.js`) are excluded from the coverage measure through `sonar.coverage.exclusions` for that reason; keep DOM wiring in those modules and pure logic where the Node tests reach it.
- **Browser tests**: installs Playwright's Chromium, builds, then runs `smoke.js` and `a11y.js`.

`reader.js` and `shot.js` never run in CI.

## Reference material (not tracked)

`docs/refs/` holds the two rulebooks as PDF and extracted text, and the draw.io flowchart that `src/flow/` was transcribed from. Grep the `.txt` files for rules questions rather than reading them whole. The flowchart XML is the source of truth when node text in `flow/pages/` looks wrong. `src/flow/anchors.json` is generated from it: after a draw.io change, run `npm run anchors` (add `--check` to see whether it is up to date) rather than editing the JSON. The script matches draw.io boxes to flow.js nodes by geometry, so a new box needs its flow.js node first.

## Conventions

- Bump `VERSION` in `src/engine/constants.js` for every published build; saved games carry it and `migrate` upgrades old saves. The README's header line carries the version and date; keep it in step with `VERSION`, as is `sonar.projectVersion` in `sonar-project.properties`, which sets the start of the New Code period on SonarQube Cloud.
- Node text in `src/flow/` is what the walker matches on. When adding a flowchart node or changing node text, update `src/walk/` to match and run `node test/check.js`. The walker's handler tables are keyed by literal `"PAGE.node"` strings, which `check.js` validates by scanning every file under `src/walk/`, so keep the keys literal.
- When adding a card flag or effect, add it to the allow-lists that `check.js` enforces.
- Enum values (`PROMPT`, `TRAIL`, `DIE_STATE`, …) and the field names of the saved game are persisted in autosaves and slots: renaming one changes what saved games hold, so it needs a `migrate` step once there are published saves to upgrade (`VERSION` is bumped only when the artifact is published). CSS class names such as `k-D`, `st-used` and `t-skip` are derived from those values too.
- A module exports only what another module imports; `engine/index.js`, `walk/index.js`, `ui/index.js` and `modals/index.js` are the public surfaces. Mutable module state (`ui/session.js`, `debug.js`, the modal modules' own state) is changed only inside its module or through a setter it exports.
- Prettier owns layout (eslint-config-prettier is last in the ESLint config). `endOfLine` is `auto`; `.gitattributes` normalises to LF.
- The stylesheets are written one declaration per line on purpose, and their class and id names are camelCase because JS references them; stylelint is configured to allow both.
- `docs/wcag-2.2.md` is the WCAG 2.2 compliance record: an accessibility-relevant change (markup, colour tokens, focus handling, target sizes, live regions) updates the affected rows and its change log in the same commit. `test/contrast.js` guards the colour tokens, the smoke test runs axe-core, and `test/a11y.js` checks the keyboard, live-region, colour-scheme, scroll-chaining and touch behaviour.
- `docs/testing.md` records what the suite cannot check and how to run the optional NVDA script; a new limit or a new test script goes there too.
