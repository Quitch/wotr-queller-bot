# Queller Bot Runner (version 60, 15 Sep 2026)

A browser app that runs the [Queller Bot](https://boardgamegeek.com/filepage/141333/queller-bot-solo-play) by Quitch, so that one person can play War of the Ring solo as the Free Peoples against a scripted Shadow player.

## What this is

Queller Bot is a set of flowcharts and priority lists that tells the Shadow side what to do. On paper you roll its dice, hold its cards and walk the charts yourself. This app can take over as much of that as you like. Each part is optional, and each works on its own:

- it can roll Queller's Action dice and keep the Hunt box;
- it may draw, hold and play Queller's cards, showing you a card only when it is played or when a flowchart needs to know whether it is playable;
- it walks the flowcharts, asks their yes/no questions and names the action Queller takes;
- it can answer those questions itself from a board tracker you keep up to date, or put every board question to you.

You carry out the actions on the board. You need a physical copy of War of the Ring (2nd Edition): the app does not replace the board, figures, dice or cards. Warriors of Middle-earth is supported and needs that expansion.

The app works by keyboard and with a screen reader, on a phone screen in portrait and landscape, and targets WCAG 2.2 Level AAA; [docs/wcag-2.2.md](docs/wcag-2.2.md) is the compliance record.

## How to use it

### Play online

The current build is published at <https://claude.ai/artifact/RZjDq2dXu5mHov9X2mmr93>. Games are saved automatically in that browser; Save / Load keeps named copies and can write a game to a file to carry on from another device.

### Run it locally

You need [Node.js](https://nodejs.org/) 24 or later.

```text
git clone https://github.com/Quitch/wotr-queller-bot.git
cd wotr-queller-bot
npm ci
npm run build
```

`npm run build` writes `index.html`; open that file in a browser. It loads its two fonts from Google Fonts and falls back to system fonts when offline.

### Playing a game

1. **New game.** Choose what the app takes over: roll and track Queller's dice, draw and hold Queller's cards, track board state in the app, and Warriors of Middle-earth. The cards and expansion choices are fixed for the game; the other two can be changed in Settings. Roll a die for Queller's starting strategy and enter the result.
2. **Each turn** press the buttons at the top of the walkthrough in turn order: Phase 1 (dice and cards), Phase 2 (strategy check, corruption strategy only), Phase 3 (Hunt box), Phase 4 (roll), then Phase 5 each time Queller is eligible to act. When a battle starts, use Battle for the first round; the button becomes Battle (next round) while the battle continues. Phase 6 is the victory check, and the next turn begins at Phase 1.
3. **Answer each step.** A decision asks a question. An action names what Queller does: press Done, or Not possible if the game rules prevent it. A step is something to do before continuing. Italic terms show their definition when you hover, focus or tap them.
4. **Keep the tracker up to date** when board tracking is on. It answers the questions about the Fellowship, minions, nations and factions for you, and decides which of Queller's cards can be played without showing you the rest of the hand.
5. **Mistakes.** Undo reverses your last action, up to 60 steps. Save / Load keeps named copies or moves a game to another device.
6. **Help, Rules, Glossary and Flowcharts** are in the header; on a narrow screen they fold into the Tools menu.

### Reporting a problem

If the app itself goes wrong (a step that makes no sense, a card or die handled wrongly, a button that does nothing), open Settings and press Export debug log. Attach the log to a [GitHub issue](https://github.com/Quitch/wotr-queller-bot/issues) with a short description of what you expected. The log holds the game state, the last actions you took and any errors. It also shows Queller's hidden cards, so only read it if you do not mind seeing them.

## Development

The sources are ES modules under `src/`, bundled by esbuild into the single-file `index.html`. With Node 24 installed, `npm ci` sets the project up, `npm run build` builds the page, and `npm run verify` runs every linter and every Node test; run it before committing.

- [docs/development.md](docs/development.md): every npm script, the build, the CI workflow and the conventions.
- [docs/architecture.md](docs/architecture.md): how the code is organised, layer by layer.
- [docs/testing.md](docs/testing.md): what each test checks and what the suite cannot see.
- [docs/wcag-2.2.md](docs/wcag-2.2.md): the WCAG 2.2 compliance record.

## Licence and credits

The code in this repository is released under the [MIT Licence](LICENSE).

Queller Bot for War of the Ring (version 3.3) is © Quitch and licensed under [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/). Its bot text, flowcharts and rules are reproduced here with the author's permission; see the [file page on BoardGameGeek](https://boardgamegeek.com/filepage/141333/queller-bot-solo-play).

War of the Ring, Middle-earth and The Lord of the Rings and the characters, items, events, and places therein are trademarks of Middle-earth Enterprises, LLC used under license by Ares Games srl. War of the Ring Second Edition and Warriors of Middle-earth © Ares Games srl. Event card and Action die text is reproduced only as a play aid for owners of the game. This is an unofficial fan-made tool and is not affiliated with, endorsed or sponsored by Ares Games or Middle-earth Enterprises.
