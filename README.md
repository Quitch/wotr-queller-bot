# Queller Bot Runner — sources (version 59, 14 Sep 2026)

`npm run build` bundles `src/` into `index.html` (the single-file artifact; the Artifact host adds the doctype/head/body). The sources are ES modules; esbuild follows the imports from `src/main.js` and the `@import`s from `src/styles/index.css` and writes one classic, unminified script and one stylesheet into the page.

Tests (run all before building):

    node test/check.js    # static: every "PAGE.node" key under src/walk/ exists, priority criteria resolve, grey boxes have JUMPS entries, card flags valid
    node test/verify.js   # scripted scenarios, one per behaviour fix
    node test/debuglog.js # debug log module: action history, walk trails, error capture, persistence, the exported log
    node test/fuzz.js 1   # 400 random games (any seed) across all 16 setting combinations: no exceptions, no walk left without a prompt, card totals conserved
    node test/fuzz.js 1 --digest  # the same, printing a sha1 of every final state (unchanged by a refactor that preserves behaviour)
    node test/smoke.js    # Playwright: plays a turn in the built page, tracker triggers, modals, debug log export, a rolled-back action, an uncaught error, reload from autosave, a broken autosave; fails on any unexpected page error
    node test/shot.js     # screenshots of the full and minimal tracker layouts, the error bar, the debug log modal (light/dark/phone) and the broken-autosave screen (test/shot-*.png)

`src/`: `flow/` (the ten flowchart pages, the node and edge accessors, and `anchors.json` — generated arrow routing, regenerate with sync_anchors.py after a draw.io change), `cards/` (79 cards with behaviour flags), `ref/` (glossary, rules, rulings, turn sequence), `engine/` (state, dice, cards, playability, priorities, table triggers; `VERSION` in `engine/constants.js`), `walk/` (the flowchart walker), `debug.js` (action history, error capture, the exportable debug log — kept outside the game state, persisted under `qb.debug`), `ui/` (rendering, undo, autosave), `modals/` (the dialogs), `styles/` (one file per concern, joined by `index.css`), `qb.js` (the engine and walker as one namespace) and `main.js` (the entry point). `test/load.js` imports the modules the Node tests need.

`build.js` defines `QB_BUILT` (UTC build time) into the script; the debug log shows it. Bump `VERSION` in `engine/constants.js` for each published build (saved games carry it and `migrate` upgrades older ones).
