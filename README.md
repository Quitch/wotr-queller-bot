# Queller Bot Runner — sources (version 59, 14 Sep 2026)

`python3 build.py` concatenates `src/` into `index.html` (the single-file artifact; the Artifact host adds the doctype/head/body).

Tests (run all before building):

    node test/check.js    # static: walk.js node keys exist, priority criteria resolve, grey boxes have JUMPS entries, card flags valid
    node test/verify.js   # scripted scenarios, one per behaviour fix
    node test/debuglog.js # debug log module: action history, walk trails, error capture, persistence, the exported log
    node test/fuzz.js 1   # 400 random games (any seed) across all 16 setting combinations: no exceptions, no walk left without a prompt, card totals conserved
    node test/fuzz.js 1 --digest  # the same, printing a sha1 of every final state (unchanged by a refactor that preserves behaviour)
    node test/smoke.js    # Playwright: plays a turn in the built page, tracker triggers, modals, debug log export, a rolled-back action, an uncaught error, reload from autosave, a broken autosave; fails on any unexpected page error
    node test/shot.js     # screenshots of the full and minimal tracker layouts, the error bar, the debug log modal (light/dark/phone) and the broken-autosave screen (test/shot-*.png)

`src/`: flow.js (flowcharts), anchors.js (generated arrow routing — regenerate with sync_anchors.py after a draw.io change), cards.js (79 cards with behaviour flags),
ref.js (glossary, rules, rulings, turn sequence), engine.js (state, dice, cards, playability, table triggers; `VERSION`), walk.js (flowchart walker), debug.js (action history, error capture, the exportable debug log — kept outside the game state, persisted under `qb.debug`), ui.js, modals.js, styles.css. The script order is `SOURCE_ORDER` in build.py, mirrored by `ENGINE_SOURCES` in test/load.js.

build.py stamps `window.QB_BUILT` (UTC build time) into the page; bump `VERSION` in engine.js for each published build (saved games carry it and `migrate` upgrades older ones).
