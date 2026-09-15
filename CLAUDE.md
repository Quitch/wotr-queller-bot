# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Queller Bot for War of the Ring: a single-file web app that walks the Queller bot flowcharts for the board game War of the Ring, so a human plays the Free Peoples against a scripted Shadow player. The sources in `src/` are ES modules that `build.js` bundles with esbuild into `index.html`, which is published as a Claude Artifact (the host adds the doctype/head/body, so the page starts at `<title>`). `index.html` is not tracked.

## Where things are documented

- `docs/architecture.md`: the layers of `src/` (`flow/`, `cards/`, `ref/`, `engine/`, `walk/`, `qb.js`, `debug.js`, `ui/`, `modals/`, `styles/`), the import-cycle rule, the public surfaces and what `test/load.js` gives the tests. Read it before changing the walker, the engine or the UI.
- `docs/development.md`: every npm script, the build, the CI workflow and SonarQube Cloud, the untracked reference material in `docs/refs/`, and the conventions in full.
- `docs/testing.md`: what each test script checks, the audit's manual checks and what the suite cannot see, and the optional NVDA setup.
- `docs/wcag-2.2.md`: the WCAG 2.2 compliance record.
- `README.md`: written for players; its header line carries the version and date.

## Commands

```text
npm run build           # bundle src/ into index.html
npm run verify          # all linters + all Node tests; run before committing
npm test                # the Node tests: check.js, verify.js, debuglog.js, render.js, ui.js, contrast.js, fuzz.js 1
npm run smoke           # the Playwright browser test of the built index.html (build first)
npm run a11y            # the Playwright accessibility checks of the built index.html (build first)
npm run reader          # the optional NVDA screen-reader check (Windows, headed, never in CI)
```

Tests are plain Node scripts (no test runner); each exits 1 on failure, and any one runs with `node test/<name>.js`. `node test/fuzz.js <seed> --digest` prints a sha256 of every final state: a refactor that preserves behaviour leaves it unchanged. `docs/refs/` (untracked) holds the rulebooks as text and the draw.io flowchart; grep the `.txt` files for rules questions, and treat the flowchart XML as the source of truth when node text in `src/flow/pages/` looks wrong.

## Conventions to follow on every edit

- The walker's handler tables under `src/walk/` are keyed by literal `"PAGE.node"` strings that `test/check.js` validates against `src/flow/`; keep the keys literal, and when a flowchart node or its text changes, update `walk/` to match and run `node test/check.js`. A new card flag or effect goes into the allow-lists `check.js` enforces.
- Bump `VERSION` in `src/engine/constants.js` (with the README's header line and `sonar.projectVersion` in `sonar-project.properties`) only when the artifact is published. Enum values and saved-game field names are persisted in autosaves and slots, so renaming one needs a `migrate` step once published saves exist.
- Read flowchart nodes and edges through the `NODE` / `EDGE` accessors, never by slot.
- `src/flow/anchors.json` is generated: run `npm run anchors` after a draw.io change; never hand-edit it.
- A module exports only what another module imports; `engine/index.js`, `walk/index.js`, `ui/index.js` and `modals/index.js` are the public surfaces. Mutable module state (`ui/session.js`, `debug.js`, the modal modules' own state) changes only inside its module or through a setter it exports. Never read a binding imported across an import cycle while a module evaluates.
- Keep DOM wiring in `main.js`, `ui/boot.js`, `ui/wire.js`, `ui/tooltip.js` and `modals/framework.js` (excluded from Sonar's coverage) and pure logic where the Node tests reach it; every other module under `ui/` and `modals/` must import without a DOM.
- A behaviour fix gets a scripted scenario in `test/verify.js` (a named function listed in `SCENARIOS`).
- Prettier owns layout. The stylesheets are one declaration per line with camelCase class and id names; stylelint allows both.
- An accessibility-relevant change (markup, colour tokens, focus handling, target sizes, live regions) updates the affected rows and the change log of `docs/wcag-2.2.md` in the same commit. A new test script or a new limit of the suite goes into `docs/testing.md`.
