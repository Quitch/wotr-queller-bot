# Queller Bot Runner — sources (version 59, 14 Sep 2026)

`npm run build` bundles `src/` into `index.html` (the single-file artifact; the Artifact host adds the doctype/head/body). The sources are ES modules; esbuild follows the imports from `src/main.js` and the `@import`s from `src/styles/index.css` and writes one classic script (minified, with function names kept for the debug log's stack traces) and one stylesheet into the page. `docs/wcag-2.2.md` records where the app stands against WCAG 2.2 and how each criterion is met.

Tests (run all before building):

    node test/check.js    # static: every "PAGE.node" key under src/walk/ exists, priority criteria resolve, grey boxes have JUMPS entries, card flags and counts valid, every *term* marker and "rule N" citation resolves, anchors.json matches the edges, every prompt type has an answer handler and a renderer
    node test/verify.js   # scripted scenarios, one per behaviour fix
    node test/debuglog.js # debug log module: action history, walk trails, error capture, persistence, the exported log
    node test/render.js   # the whole UI built without a DOM: 32 short random games rendering the game screen, every prompt, every card half, every modal's content and every flowchart SVG; every arrow routes between its boxes
    node test/ui.js       # unit tests of the UI's pure logic: text markup, board paths, tracker values, storage and save loading, widgets, phase tables, trail/result/card renderers
    node test/contrast.js # the colour tokens of both themes and the flowchart strokes against their backgrounds: text at 7:1, borders and strokes at 3:1
    node test/fuzz.js 1   # 400 random games (any seed) across all 16 setting combinations: no exceptions, no walk left without a prompt, card totals conserved
    node test/fuzz.js 1 --digest  # the same, printing a sha256 of every final state (unchanged by a refactor that preserves behaviour)
    node test/smoke.js    # Playwright: plays a turn in the built page, tracker triggers, modals, debug log export, a rolled-back action, an uncaught error, reload from autosave, a broken autosave, then a 360px touch screen (the Tools menu, no sideways scroll); axe-core runs on every screen and modal; fails on any unexpected page error or a serious axe violation
    node test/shot.js     # screenshots of the full and minimal tracker layouts, the error bar, the debug log modal (light/dark/phone), the broken-autosave screen, and the phone layouts in portrait and landscape (test/shot-*.png)

`npm test` runs the Node tests (everything above except `smoke.js` and `shot.js`); `npm run coverage` runs them under c8 and prints a coverage table alongside `coverage/lcov.info`; `npm run smoke` runs the browser test against a built `index.html`. The `Verify` GitHub Actions workflow runs lint, coverage and the build in one job (and, when the `SONAR_TOKEN` secret is present, sends the LCOV report to SonarQube Cloud, whose coverage figure is therefore the Node-side coverage only; the browser-only modules are excluded from it in `sonar-project.properties`) and the browser smoke test in another. `test/play.js` is the random game driver `fuzz.js` and `render.js` share; `test/load.js` is the one place the tests reach into `src/`.

`src/`: `flow/` (the ten flowchart pages, the node and edge accessors, and `anchors.json` — generated arrow routing, regenerate with `npm run anchors` after a draw.io change), `cards/` (79 cards with behaviour flags), `ref/` (glossary, rules, rulings, turn sequence), `engine/` (state, dice, cards, playability, priorities, table triggers; `VERSION` in `engine/constants.js`), `walk/` (the flowchart walker), `debug.js` (action history, error capture, the exportable debug log — kept outside the game state, persisted under `qb.debug`), `ui/` (rendering, undo, autosave), `modals/` (the dialogs), `styles/` (one file per concern, joined by `index.css`), `qb.js` (the engine and walker as one namespace) and `main.js` (the entry point). `test/load.js` imports the modules the Node tests need.

`build.js` defines `QB_BUILT` (UTC build time) into the script; the debug log shows it. Bump `VERSION` in `engine/constants.js` for each published build (saved games carry it and `migrate` upgrades older ones).
