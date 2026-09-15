<!--
Title the pull request as one sentence in the style of a commit subject, for example
"Expand the tests and report coverage to SonarQube Cloud". Fill in the sections below;
delete a "When it applies" group that does not apply. The rules behind the checklist
are in CLAUDE.md, docs/development.md (Conventions), docs/testing.md and docs/wcag-2.2.md.
-->

<!-- markdownlint-disable MD041 -->

## Summary

<!-- What changes and why. Name the files or modules touched and say what a player or developer sees differently. -->

## How it was tested

<!-- Which scripts you ran locally beyond `npm run verify` (smoke, a11y, reader, shot, fuzz digest) and anything checked by hand in a browser. -->

## Checklist

### Every change

- [ ] `npm run verify` passes locally (all linters and all Node tests).
- [ ] `VERSION` in `src/engine/constants.js`, the README header line and `sonar.projectVersion` are unchanged; the maintainer bumps them when a build is published.
- [ ] No enum value or saved-game field name is renamed, or the rename comes with a `migrate` step.
- [ ] Each module exports only what another module imports; `engine/index.js`, `walk/index.js`, `ui/index.js` and `modals/index.js` remain the public surfaces, mutable module state changes only inside its module or through an exported setter, and no binding imported across an import cycle is read while a module evaluates.
- [ ] DOM wiring stays in `main.js`, `ui/boot.js`, `ui/wire.js`, `ui/tooltip.js` and `modals/framework.js`; every other module under `ui/` and `modals/` still imports without a DOM.
- [ ] Layout is left to Prettier (`npm run format`); no hand formatting.
- [ ] Any SonarQube Cloud and CodeQL code scanning findings on the pull request are addressed (the Sonar scan is skipped on a pull request from a fork).

### When it applies

#### A behaviour fix

- [ ] A scripted scenario in `test/verify.js` (a named function listed in `SCENARIOS`) reproduces the fault and passes with the fix.

#### A refactor that should not change behaviour

- [ ] `node test/fuzz.js 7 --digest` prints the same sha256 as on `main`.

#### A flowchart node, its text, or the walker

- [ ] `src/walk/` matches the node text in `src/flow/`, the handler keys are literal `"PAGE.node"` strings, and `node test/check.js` passes.
- [ ] After a draw.io change, `src/flow/anchors.json` was regenerated with `npm run anchors`, not edited by hand.

#### A card flag or effect

- [ ] The new flag or effect is in the allow-lists that `test/check.js` enforces.

#### Markup, styles or anything a player sees

- [ ] `npm run build`, then `npm run smoke` and `npm run a11y`, pass locally.
- [ ] Stylesheets keep one declaration per line and camelCase class and id names.

#### An accessibility-relevant change (markup, colour tokens, focus handling, target sizes, live regions)

- [ ] The affected rows and the change log of `docs/wcag-2.2.md` are updated in the same commit as the change.
- [ ] `npm run reader` was run on Windows when the change affects what a screen reader announces.

#### Tests or documentation

- [ ] A new test script, or a new limit of what the suite can check, is recorded in `docs/testing.md`.
- [ ] `docs/architecture.md` and `docs/development.md` still describe the layers, public surfaces and scripts correctly.

## Contributor licence agreement

- [ ] I am the author of this contribution, or I have the right to submit it. I agree that it is contributed under the [MIT Licence](https://github.com/Quitch/wotr-queller-bot/blob/main/LICENSE) of this repository, that the project owner may use, change, relicense and distribute it without further permission or attribution beyond what that licence requires, and that I claim no ownership of, or rights over, the project's code on the strength of this contribution.
