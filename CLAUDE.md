# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Queller Bot for War of the Ring: a single-file web app that walks the Queller bot flowcharts for the board game War of the Ring, so a human plays the Free Peoples against a scripted Shadow player. The sources in `src/` are ES modules that `build.js` bundles with esbuild into `index.html`, which is published as a Claude Artifact (the host adds the doctype/head/body, so the page starts at `<title>`). `index.html` is not tracked.

## Commands

```text
npm run build           # bundle src/ into index.html (esbuild; defines QB_BUILT with the UTC build time)
npm run verify          # all linters + all Node tests; run before committing
npm run lint            # eslint + stylelint + markdownlint + prettier --check
npm run format          # prettier --write .
npm test                # check.js, verify.js, debuglog.js, render.js, ui.js, fuzz.js 1
npm run coverage        # npm test under c8: a text report plus coverage/lcov.info (what SonarQube Cloud reads); src files no test imports count as 0%
npm run smoke           # the Playwright browser test of the built index.html (build first)
```

Tests are plain Node scripts (no test runner); each exits 1 on failure. Run one directly:

```text
node test/check.js      # static: every "PAGE.node" key under src/walk/ exists (at least 129 of them), priority criteria resolve, grey boxes have JUMPS entries, card flags and counts valid, every *term* marker and "rule N" citation resolves, anchors.json matches the edges, every PROMPT type has an answer handler and a renderer
node test/verify.js     # scripted scenarios (driveWalk() answers prompts by regex until the walk finishes)
node test/debuglog.js   # debug log module
node test/render.js     # the whole UI built without a DOM: 32 short random games (test/play.js) rendering the game screen, every prompt, every card half, every modal's content and every flowchart SVG; every arrow routes between its boxes
node test/ui.js         # unit tests of the UI's pure logic: text markup, board paths, tracker values, storage and save loading, widgets, phase tables, trail/result/card renderers
node test/fuzz.js 7     # 400 random games with seed 7 across all 16 setting combinations; any seed works
node test/fuzz.js 7 --digest  # also prints a sha256 of every final state: a refactor that preserves behaviour leaves it unchanged
node test/smoke.js      # Playwright browser run of the built index.html (build first; needs `npx playwright install chromium`)
node test/shot.js       # Playwright screenshots to test/shot-*.png (build first)
```

The Node tests never touch the DOM. `test/load.js` is the one place they reach into `src/`: it re-exports the engine and walker (`QB`), the flowchart data (`QB_FLOW`, `QB_NODE`, `QB_NODE_KIND`, `QB_EDGE`), the cards (`QB_CARDS`), the reference text (`GLOSSARY`, `RULES`, …), the debug log (`QB_DEBUG`), the UI surface (`QB_UI`) and the UI's pure HTML builders and tables (`gameHTML`, `promptHTML`, `PROMPT_RENDERERS`, `MODAL_REGISTRATIONS`, `svgPage`, `route`, …). Every module under `ui/` and `modals/` imports without a DOM (all `document`/`window` use is inside function bodies), so `test/render.js` builds the whole page and every modal's content in Node; only the DOM wiring (`render()`, `act()`, `boot()`, `wire.js`, `tooltip.js`, the modal framework) is left to the Playwright scripts, which are not part of `npm test` (the `browser` CI job runs `smoke.js`); `test/browser.js` serves the built page and launches Chromium for both. `test/play.js` is the random game driver `fuzz.js` and `render.js` share: a seeded `Math.random`, a random answer to every prompt, and hooks around every answer (`onWalkStart`, `onPrompt`, `afterAnswer`, `afterPhase`) for a test's own checks.

## Architecture

`src/` is a tree of ES modules with explicit imports; `main.js` is the entry point and the only module with side effects (it sets `window.QB` and `window.QBUI` for the devtools and the Playwright tests and boots on `DOMContentLoaded`). The layers, from the bottom up:

- **flow/** — `FLOW`: the ten flowchart pages transcribed from the draw.io file, one module each under `pages/` (the two Phase 5 pages share `pages/threat-column.js`). `page.js` names the tuple slots; `index.js` exports the `NODE_KIND` enum (START, ACTION, DECISION, FOLLOW_UP, JUMP, PRIORITY, STEP, NOTE; the values are the one-letter codes in the data), the `NODE` / `EDGE` accessors (`kind`, `text`, `extra`, `box`; `from`, `to`, `label`, …) — read nodes and edges through them, never by slot — and assembles `FLOW` from the pages. `anchors.json` is the generated arrow routing (exit/entry anchors and waypoints per edge) that `anchors.js` writes into the edges; `npm run anchors` (`scripts/sync-anchors.js`) regenerates it from the untracked `docs/refs/flowchart.drawio`, so do not hand-edit the JSON. Node text is what the walker matches on, so wording changes here can break `walk/`.
- **cards/** — `CARDS`: 79 Shadow cards, the 2nd Edition ones in `base.js` and the Warriors of Middle-earth ones in `wome.js`, concatenated in that order (the seeded shuffle depends on it). Each card has behaviour flags (`onTable`, `revealed`, `tile`, `corruption`, `pre`, `cpre`, `effect`, …); the engine reads flags only, never the card text. `pre`/`cpre` are keys into `PRECONDITIONS`/`COMBAT_PRECONDITIONS` in `engine/preconditions.js`, and `check.js` verifies every key resolves. The header comment of `base.js` lists the text fields (`title`/`cond`/`text` for the event half, `combatTitle`/`combatCond`/`combatText` for the combat half).
- **ref/** — glossary (`GLOSSARY`, `GLOSSARY_ALIASES`), rules, rulings and the turn sequence, data only; each file's header gives its shape.
- **engine/** — the game engine; `index.js` re-exports its public names. `constants.js` holds `VERSION` (stamped on saves and shown in the debug log) and the enums the rest of the code shares: `STRATEGY`, `PHASE`, `DECK`, `DIE_KIND`, `DIE_STATE`, `FACE`, `DIE_REQUIREMENT`, `CARD` (the card ids treated specially), `TRAIL` (the kinds of trail entry a walk records). Then `state.js` (`newState`, `buildDecks`, `migrate`), `dice.js`, `hand.js`, `cards.js` (`cardById`, card flags), `board.js` (board queries), `preconditions.js`, `effects.js` (card effects the engine resolves itself), `triggers.js` (table cards discarded on a tracker change), `priority.js` (`criterionTest`, `applyPriority`, `chooseByRank`, `autoDiscard`) and `log.js`.
- **walk/** — the flowchart walker; `index.js` exports `startWalk`, `startPhase`, `startBattle`, `run`, `answer`, `nextTurn` and the `PROMPT` / `WALK_RESULT` enums. `prompt.js` defines the prompt types (YES_NO, COUNT, SITUATIONAL, CONFIRM, DIE_CHECK, RING, ACTION, STEP, ROLL, PLAY_CARD, CHOICE, PRIORITY, BATTLE_FORM) and the two sentinels handlers return (`PENDING`: a prompt is open; `FALL_THROUGH`: use the generic handling), which are compared by identity, so they have this one home. `core.js` creates a walk and moves it along arrows; `run.js` steps it from box to box, dispatching by box kind to `decisions/` (one module per page plus `common.js`; `index.js` assembles `DECISION_HANDLERS`), `jumps.js` (grey boxes, with the `JUMPS` table in `jumps-table.js` mapping box text to page/start/die), `actions.js` (`ACTION_HANDLERS`), `steps.js` (`STEP_HANDLERS`) and `priority.js` (`PRIORITY_HANDLERS`), resolving what it can from state and otherwise setting `state.walk.prompt` (`{type, text, …}`) and returning until `answer(state, value)` (`answers.js`, `ANSWER_HANDLERS` keyed by `PROMPT.*`) is called; a finished walk has `walk.result` (`WALK_RESULT` or `phaseResult(name)`). `phases.js` is the phase driver. The handler tables are keyed by literal `"PAGE.node"` strings, which `check.js` validates against `flow/` by scanning every file under `src/walk/`, so keep the keys literal. `jumps-table.js` also lists `CARD_CRITERIA_NODES`, the priority lists that pick a card.
- **qb.js** — `export *` of `engine/index.js` and `walk/index.js`: the QB namespace (`window.QB` in the page, `QB` in the tests). Importers use `import * as engine from "../qb.js"` and call `engine.X`.
- **debug.js** — `QB_DEBUG`: action history, walk trails and error capture kept _outside_ the game state (never saved, undone or shown during play), persisted in localStorage under `qb.debug` so a log survives a reload. `actions`, `errors` and `walks` are exported live bindings.
- **ui/** — renders the game state, drives prompt → `QB.answer` → re-render inside `act()` (`actions.js`), keeps an undo stack of JSON snapshots and autosaves to localStorage (`constants.js`: `STORAGE_KEY` — `qb.autosave`, save slots `qb.slots`, options `qb.opts` — and the `MODAL` names). `session.js` holds the game, the undo stack, the open modal and the shown table card as live bindings: import them to read, call the setters (`setState`, …) to change them. `render.js` draws the page from the panel modules (`header`, `walkthrough`, `prompts`, `dice`, `hand`, `tracker`, `trail`, `card`, `battle-form`, `widgets`), `wire.js` attaches the handlers in `handlers.js`, `boot.js` restores the page and installs the error bar, `tooltip.js` the glossary tooltips, `ask.js` opens modals. `index.js` is the surface `modals/`, `main.js` and the Playwright tests use (`window.QBUI`), including `find`, `escapeHTML`, `formatText`, `parseJSONOr`, `onClickEach`.
- **modals/** — `framework.js` is the dialog (one element, focus trap, `renderModal`, `closeModal`) plus a registry; each modal is one module exporting its registration `{content, wire?, headerButtons?, beforeRender?, focusOnOpen?}` (glossary, help, rules, ask, jump, settings, save, debug, calc, and the flowchart viewer in `flow/` with its SVG and arrow routing), and `index.js` registers them under the `MODAL` names.
- **styles/** — `index.css` imports one file per concern in cascade order; `build.js` inlines them. The order is deliberate (see the comment in `index.css`).

Import cycles: `ui/` and `modals/` import each other, and `run.js → actions.js → jumps.js → run.js` inside the walker, but only through functions called at run time. Never read a binding imported across a cycle while a module evaluates (for example, to build a table); `MODAL` and the text helpers therefore come from `ui/constants.js` and `ui/dom.js` directly, not from `ui/index.js`.

The stylesheets are written one declaration per line on purpose and their class/id names are camelCase because JS references them; stylelint is configured to allow both.

## Reference material (not tracked)

`docs/ref/` holds the two rulebooks as PDF and extracted text, and the
draw.io flowchart that `flow/` was transcribed from. Grep the `.txt`
files for rules questions rather than reading them whole. The flowchart
XML is the source of truth when node text in `flow/pages/` looks wrong.

## Conventions

- Bump `VERSION` in `engine/constants.js` for every published build; saved games carry it and `migrate` upgrades old saves.
- When adding a flowchart node or changing node text, update `walk/` to match and run `node test/check.js`; when adding a card flag or effect, add it to the allow-lists that `check.js` enforces.
- A module exports only what another module imports; `engine/index.js`, `walk/index.js`, `ui/index.js` and `modals/index.js` are the public surfaces. Mutable module state (`ui/session.js`, `debug.js`, the modal modules' own state) is changed only inside its module or through a setter it exports.
- `npm run coverage` writes `coverage/lcov.info`; the CI `verify` job hands it to SonarQube Cloud (CI-based analysis, `sonar-project.properties`, the `SONAR_TOKEN` repository secret), so Sonar's coverage figure is the Node-side coverage only: the browser smoke test runs in the separate `browser` job and is not in it.
- Behaviour fixes get a scripted scenario in `test/verify.js` (a named function listed in `SCENARIOS`, typically `phase5State()` + `driveWalk()` with `[pattern, answer]` rules); the fuzz test is the safety net for exceptions, walks left without a prompt, and card-count conservation, and its `--digest` shows whether a change altered any game's outcome.
- Enum values (`PROMPT`, `TRAIL`, `DIE_STATE`, …) and the field names of the saved game are persisted in autosaves and slots: renaming one changes what saved games hold, so it needs a `migrate` step once there are published saves to upgrade (`VERSION` is bumped only when the artifact is published). CSS class names such as `k-D`, `st-used` and `t-skip` are derived from those values too.
- `src/flow/anchors.json` is generated: after a draw.io change, run `npm run anchors` (add `--check` to see whether it is up to date) rather than editing it. The script matches draw.io boxes to flow.js nodes by geometry, so a new box needs its flow.js node first.
- Prettier owns layout (eslint-config-prettier is last in the ESLint config). `endOfLine` is `auto`; `.gitattributes` normalises to LF.
- The README's header line carries the version and date; keep it in step with `VERSION`.
