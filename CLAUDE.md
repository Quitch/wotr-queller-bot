# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Queller Bot for War of the Ring: a single-file web app that walks the Queller bot flowcharts for the board game War of the Ring, so a human plays the Free Peoples against a scripted Shadow player. The sources in `src/` are concatenated by `build.py` into `index.html`, which is published as a Claude Artifact (the host adds the doctype/head/body, so the page starts at `<title>`). `index.html` is not tracked.

## Commands

```text
python3 build.py        # concatenate src/ into index.html (stamps window.QB_BUILT with the UTC build time)
npm run verify          # all linters + all Node tests; run before committing
npm run lint            # eslint + stylelint + markdownlint + prettier --check
npm run format          # prettier --write .
npm test                # check.js, verify.js, debuglog.js, fuzz.js 1
```

Tests are plain Node scripts (no test runner); each exits 1 on failure. Run one directly:

```text
node test/check.js      # static: walk.js node keys exist, priority criteria resolve, grey boxes have JUMPS entries, card flags valid
node test/verify.js     # scripted scenarios (drive() answers prompts by regex until the walk finishes)
node test/debuglog.js   # debug log module
node test/fuzz.js 7     # 400 random games with seed 7 across all 16 setting combinations; any seed works
node test/smoke.js      # Playwright browser run of the built index.html (build first; needs `npx playwright install chromium`)
node test/shot.js       # Playwright screenshots to test/shot-*.png (build first)
```

The Node tests never touch the DOM: `test/load.js` evals flow, anchors, cards, ref, engine, walk and debug into a fake `window` on `global`. `ui.js` and `modals.js` are only exercised by the Playwright scripts, which are not part of `npm test`.

## Architecture

`src/` is a set of classic (non-module) scripts, each an IIFE, sharing data through `window.QB*` globals. Order matters and is fixed in `build.py` and `test/load.js`:

1. **flow.js** — `window.QB_FLOW`: the ten flowchart pages transcribed from the draw.io file. A page is `{name, nodes, edges}`; a node is the tuple `[kind, x, y, w, h, text, extra]` (kinds: S start, A action, D/d decision, J jump, P priority list, T step, N note); an edge is `[from, to, label, waypoints]`. Node text is what the walker matches on, so wording changes here can break `walk.js`.
2. **anchors.js** — generated arrow routing for the flowchart SVGs. Tracked, but ignored by eslint/prettier. The generator (`sync_anchors.py`) and the `.drawio` file are not in this repo; do not hand-edit.
3. **cards.js** — `window.QB_CARDS`: 79 Shadow cards with behaviour flags (`onTable`, `revealed`, `tile`, `corruption`, `pre`, `cpre`, `effect`, …). The engine reads flags only, never the card text; `pre`/`cpre` are keys into `PRECONDITIONS`/`COMBAT_PRECONDITIONS` in engine.js, and `check.js` verifies every key resolves.
4. **ref.js** — glossary, rules, rulings, turn sequence (`window.QB_GLOSSARY`, `QB_RULES`, `QB_RULINGS`, `QB_TURN`).
5. **engine.js** — `window.QB`: game state (`newState`, `migrate`), dice, decks/hand/table, playability, card priority criteria (`critFn`, `applyPriority`), table triggers, `log`. Holds `VERSION`, which is stamped on saves and shown in the debug log.
6. **walk.js** — extends `window.QB` with the flowchart walker: `startWalk`, `startPhase`, `startBattle`, `run`, `answer`, `nextTurn`. It steps through `QB_FLOW` nodes, resolving what it can from state and otherwise setting `S.walk.prompt` (`{type, text, …}`; types include yesno, count, situ, confirm, diecheck, ring, action, step, roll, playcard, choice, priority, battleForm) and returning until `answer(S, value)` is called. The `JUMPS` table maps grey-box text (regex) to the page/start node/die it jumps to. Nodes are referenced as `"PAGE.node"` strings, which `check.js` validates against `flow.js`.
7. **debug.js** — `window.QB_DEBUG`: action history, walk trails and error capture kept _outside_ the game state (never saved, undone or shown during play), persisted in localStorage under `qb.debug` so a log survives a reload.
8. **ui.js** — `window.QBUI`: renders `S`, drives prompt → `Q.answer` → re-render, keeps an undo stack of JSON snapshots, autosaves to localStorage (`qb.autosave`, save slots `qb.slots`, options `qb.opts`).
9. **modals.js** — glossary, flowchart SVG viewer (uses anchors.js), rules, combat calculator, save/load, settings, jump-to.

`styles.css` is written one declaration per line on purpose and its class/id names are camelCase because JS references them; stylelint is configured to allow both.

## Reference material (not tracked)

`docs/ref/` holds the two rulebooks as PDF and extracted text, and the
draw.io flowchart that `flow.js` was transcribed from. Grep the `.txt`
files for rules questions rather than reading them whole. The flowchart
XML is the source of truth when node text in `flow.js` looks wrong.

## Conventions

- Bump `VERSION` in `engine.js` for every published build; saved games carry it and `migrate` upgrades old saves.
- When adding a flowchart node or changing node text, update `walk.js` to match and run `node test/check.js`; when adding a card flag or effect, add it to the allow-lists that `check.js` enforces.
- Behaviour fixes get a scripted scenario in `test/verify.js` using `base()` + `drive()`; the fuzz test is the safety net for exceptions, walks left without a prompt, and card-count conservation.
- Prettier owns layout (eslint-config-prettier is last in the ESLint config). `endOfLine` is `auto`; `.gitattributes` normalises to LF.
- The README's header line carries the version and date; keep it in step with `VERSION`.
