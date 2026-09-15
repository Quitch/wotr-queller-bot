# Test coverage and its limits

What each test script checks, how the mobile / WCAG 2.2 audit's manual checks were automated, and what the suite still cannot see. The commands are in `docs/development.md` and `CLAUDE.md`.

## The tests

| Script             | Run by                                             | What it checks                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/check.js`    | `npm test`, CI                                     | Static: every `"PAGE.node"` key under `src/walk/` exists, priority criteria resolve, grey boxes have `JUMPS` entries, card flags and counts are valid, every glossary marker and rule citation resolves, `anchors.json` matches the edges, every prompt type has a handler and a renderer                                                         |
| `test/verify.js`   | `npm test`, CI                                     | Scripted scenarios, one per behaviour fix                                                                                                                                                                                                                                                                                                         |
| `test/debuglog.js` | `npm test`, CI                                     | The debug log module: action history, walk trails, error capture, persistence, the exported log                                                                                                                                                                                                                                                   |
| `test/render.js`   | `npm test`, CI                                     | The whole UI built without a DOM: 32 short random games rendering the game screen, every prompt, every card half, every modal's content and every flowchart SVG; every arrow routes between its boxes                                                                                                                                             |
| `test/ui.js`       | `npm test`, CI                                     | Unit tests of the UI's pure logic: text markup, board paths, tracker values, storage and save loading, widgets, phase tables, the trail, result and card renderers                                                                                                                                                                                |
| `test/contrast.js` | `npm test`, CI                                     | The colour tokens of both themes and the flowchart strokes against their backgrounds: text at 7:1, borders and strokes at 3:1                                                                                                                                                                                                                     |
| `test/fuzz.js`     | `npm test`, CI                                     | 400 random games across all 16 setting combinations: no exceptions, no walk left without a prompt, card totals conserved                                                                                                                                                                                                                          |
| `test/smoke.js`    | `npm run smoke`, CI browser job                    | Playwright: plays a turn in the built page, tracker triggers, every modal, the debug log export, a rolled-back action, an uncaught error, reload from autosave, a broken autosave, then a 360px touch screen (the Tools menu, no sideways scroll); axe-core on every screen and modal                                                             |
| `test/a11y.js`     | `npm run a11y`, CI browser job                     | Playwright: the live region before and after a keyboard answer, the flowchart modal by keyboard (focus order, tab activation, the Tab trap, Escape), dark-scheme native controls, scroll chaining out of the log, the trail and the modals, and on a touch screen `touch-action`, the tap pipeline, a double-tap zoom probe and modal containment |
| `test/shot.js`     | `node test/shot.js`, by hand                       | Playwright screenshots of the layouts, the error bar, the debug log modal and the phone layouts, to `test/shot-*.png`                                                                                                                                                                                                                             |
| `test/reader.js`   | `npm run reader`, by hand on Windows (never in CI) | NVDA, driven through Guidepup, speaks the game log line after an answer; skips when it cannot run                                                                                                                                                                                                                                                 |

## The audit's manual checks

The audit left five checks to a person. Each is now a scripted check, as far as a PC allows.

| Manual check                                         | Automated by                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Double-tap zoom on the steppers                      | `test/a11y.js` `checkTouch`: computed `touch-action: manipulation` on every tap target, a tap on the rings stepper acts, and `checkDoubleTapProbe`: a CDP double tap on a control with `touch-action: auto`; only when that zooms is the stepper held to scale 1                                                    |
| Modal scroll chaining                                | `test/a11y.js` `checkScrollChainingDesktop`: a wheel at the end of the game log, the walk trail and the glossary body leaves the page still, `html.modalOpen` has `overflow: hidden`, and every scrolling region computes `overscroll-behavior: contain`; `checkTouch` repeats the modal checks on the touch screen |
| Dark native selects in device mode                   | `test/a11y.js` `checkDarkNativeControls`: the computed `color-scheme` of `html`, every `select` and every checkbox follows the media query, and `data-theme` overrides it in both directions                                                                                                                        |
| A keyboard pass through the flowchart tabs           | `test/a11y.js` `checkFlowModalKeyboard`: open by Enter, the focus order title, Close, every tab, the body region, the toggle; a tab activated by Enter and by Space keeps focus and is pressed alone; the toggle by both keys; Tab and Shift+Tab wrap; Escape closes and returns focus                              |
| A screen reader hearing the log line after an answer | `test/a11y.js` `checkLiveRegionAfterKeyboardAnswer`: the one live region from boot holds the last log line and its aria snapshot carries it; `test/reader.js`: NVDA's speech log contains the line                                                                                                                  |

## What the suite cannot check

- The rendering of an open native select popup. It is drawn by the browser or the OS and cannot be captured; the computed `color-scheme` is the guard.
- iOS rubber-band overscroll, Safari and VoiceOver. Every browser test runs in Chromium.
- Double-tap zoom, when the probe reports "not reproducible here". Chromium's mobile emulation does not double-tap zoom a page with `width=device-width`, so the probe usually cannot reproduce the fault; the computed `touch-action` is then the only guard.
- Real speech, except through the optional NVDA script, and there only NVDA with Chromium on Windows.
- A touch swipe. The scroll-chaining checks use the wheel and computed styles; with `overflow: hidden` on `html` the page cannot move under any input, and a hand-rolled touch sequence would only add flake.
- Anything axe-core does not detect. axe finds a subset of the WCAG failures a person would.
- Contrast as rendered. `test/contrast.js` computes ratios from the token values, not from pixels.
- A real device. Chromium's touch emulation has no safe-area insets, no browser chrome and no OS gestures.
- The focus ring's appearance. Its colour is in the contrast test; that it is visible around every control is not checked.
- The Tab trap in every modal. It is exercised in the flowchart modal only; the others share the same framework code.
- `prefers-reduced-motion`. The prompt animation is behind the media query but no test toggles it.

## Running the optional screen-reader check

`npm run reader` runs `test/reader.js`. It needs Windows, an unlocked interactive session (NVDA sends keystrokes to the foreground window) and a one-time setup:

```text
npx @guidepup/setup setup     # prepares the OS for Guidepup (its own settings; nothing in the repo)
npx @guidepup/setup install   # a portable NVDA plus the Guidepup add-on under %LOCALAPPDATA%\guidepup\
```

Nothing is added to the repository; `@guidepup/setup` runs through `npx` and is not a dependency. `@guidepup/guidepup` is a devDependency (pure JavaScript, so the Linux CI job is unaffected).

The script skips with exit 0 and a message when it is not on Windows, when `@guidepup/guidepup` cannot be imported, when NVDA is not supported, or when NVDA cannot be started (NVDA not installed). It opens a headed Chromium window, brings it to the front, starts a game, answers the first prompts through NVDA until the game log grows, then polls NVDA's speech log for the last log line for up to five seconds. Keep the window in the foreground while it runs.
