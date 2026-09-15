# Contributing

Thanks for helping with the Queller Bot Runner. This page is the route from a clone to a merged pull request. The detail lives in `docs/`: [development.md](docs/development.md) for the scripts, the build, CI and the conventions, [architecture.md](docs/architecture.md) for how `src/` is organised, [testing.md](docs/testing.md) for what each test checks and what the suite cannot see, and [wcag-2.2.md](docs/wcag-2.2.md) for the accessibility record.

## Reporting a problem

Open a [GitHub issue](https://github.com/Quitch/wotr-queller-bot/issues) and pick a form. The bug report form requires the debug log, which holds the game state and the last actions and reveals Queller's hidden cards; how to export it is on the form and under [Reporting a problem](README.md#reporting-a-problem) in the README. The rules or flowchart question form asks for the step the app showed and the rule you believe applies.

## Setting up

You need Node 24, the version CI runs.

```text
git clone https://github.com/Quitch/wotr-queller-bot.git
cd wotr-queller-bot
npm ci
npm run build
npx playwright install chromium   # once, for the browser tests
```

`npm run build` writes `index.html`; open it in a browser. `docs/refs/`, the rulebooks and the draw.io flowchart the code was transcribed from, is not tracked and is not distributed, because that material is not ours to redistribute. Without it you cannot run `npm run anchors` or check node text against the flowchart; when a change needs either, describe the question in the pull request and the maintainer will check it.

## Making a change

1. Branch from `main` with a short kebab-case name that says what the branch does, such as `expand-test-coverage`.
2. Read the [conventions](docs/development.md#conventions) before touching the walker, the engine, the flowchart pages or the stylesheets. The ones that catch people out: handler keys under `src/walk/` are literal `"PAGE.node"` strings that `test/check.js` validates; enum values and saved-game field names are persisted, so renaming one needs a `migrate` step; `VERSION` is bumped only when a build is published; an accessibility-relevant change updates `docs/wcag-2.2.md` in the same commit.
3. A behaviour fix gets a scripted scenario in `test/verify.js`. A refactor that should change nothing is checked with `node test/fuzz.js 7 --digest`, whose sha256 must match `main`. A new test script, or a new limit of what the suite can check, is recorded in `docs/testing.md`.
4. Run `npm run verify` before every commit: it runs every linter and every Node test. Prettier owns layout; `npm run format` fixes it. For anything a player sees, also `npm run build` then `npm run smoke` and `npm run a11y`.
5. Write commits the way the history does: a one-sentence subject in sentence case with no prefix or issue number, and a body in plain prose that names the files touched and says what changes and why.

## Opening a pull request

The pull request template asks for a summary, how the change was tested, a checklist and your agreement to the contributor licence terms below; tick what applies and delete the checklist groups that do not. The `Verify` workflow runs the linters, the Node tests with coverage, the build and the Playwright smoke and accessibility tests on every pull request, and GitHub's CodeQL code scanning reports on it too; fix what either raises before asking for review. The SonarQube Cloud scan needs a repository secret, so it is skipped on a pull request from a fork; the maintainer reviews the scan after merge. Two checks never run in CI: `npm run reader`, the NVDA screen-reader check, which needs Windows, and `node test/shot.js`, which takes screenshots for a layout change. Run whichever applies and say so in the pull request.

Pull requests are merged with a merge commit, so the branch's own commits stay in the history; keep them tidy rather than squashing everything into one.

## Licence and contributor agreement

Code contributions are accepted under the [MIT Licence](LICENSE) that covers the repository. By opening a pull request you confirm that you wrote the contribution or have the right to submit it, that it is contributed under that licence, that the project owner may use, change, relicense and distribute it without further permission or attribution beyond what the licence requires, and that you claim no ownership of, or rights over, the project's code on the strength of your contribution. The pull request template has a checkbox for this; a pull request is not merged until it is ticked.

The Queller Bot text, flowcharts and rules are © Quitch under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) and are reproduced with the author's permission, and the War of the Ring card and die text is reproduced only as a play aid. Do not add rulebook or card text beyond what a step needs to be played.
