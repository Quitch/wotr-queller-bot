// Random games across every setting combination (the driver is test/play.js): exceptions, walks left without a prompt,
// runaway walks, card-count conservation and a game that would not load back from its save are reported; a seed
// reproduces a run. Exit 1 on any problem.
import crypto from "node:crypto";
import { QB as engine } from "./load.js";
import {
  SETTING_COMBINATIONS,
  game,
  recordProblem,
  reportProblems,
  seedRandom,
  settingsFromBits,
} from "./play.js";
const { PROMPT, CARD_EFFECT } = engine;
const cardById = engine.cardById;
seedRandom(+process.argv[2] || 1);
// --digest: print a sha256 over every final game state, so a refactor that
// should not change behaviour can be checked against a recorded hash
const wantDigest = process.argv.includes("--digest");
const digest = crypto.createHash("sha256");
const GAMES_PER_SETTING = 25;
// How many cards the game holds in total, and how many distinct ones (a card duplicated or lost shows up in either).
function cardTotals(state) {
  const cards = state.cards;
  const all = [].concat(
    ...Object.values(cards.decks),
    ...Object.values(cards.discards),
    cards.hand,
    cards.factionHand,
    cards.table,
    cards.factionTable,
  );
  return { count: all.length, unique: new Set(all).size };
}
const totalsText = (totals) => totals.count + ":" + totals.unique;
const sameTotals = (a, b) => a.count === b.count && a.unique === b.unique;
// A walk that is not done must always be waiting on a prompt.
function checkPromptPresent(state, tag) {
  if (state.walk.prompt) return true;
  recordProblem(
    "LIMBO walk not done and no prompt",
    tag +
      " node " +
      state.walk.page +
      "." +
      state.walk.node +
      " trail:" +
      state.walk.trail
        .slice(-4)
        .map((entry) => entry.kind + ":" + (entry.text || "").slice(0, 30))
        .join(" | "),
  );
  return false;
}
// The played card's effect reshuffles the Faction deck, which may legitimately change the totals.
const reshufflesFactionDeck = (prompt) =>
  prompt.type === PROMPT.PLAY_CARD &&
  [CARD_EFFECT.SERVANTS, CARD_EFFECT.HIS_WILL].includes(
    cardById[prompt.card]?.effect,
  );
// The card counts after an answer must match the ones before it (the totals expected are kept per walk).
let expectedTotals = null;
function checkCardConservation(state, tag, prompt) {
  const now = cardTotals(state);
  if (sameTotals(now, expectedTotals)) return;
  if (reshufflesFactionDeck(prompt)) {
    expectedTotals = now;
    return;
  }
  recordProblem(
    "CARD TOTAL CHANGED " + totalsText(expectedTotals) + "->" + totalsText(now),
    tag +
      " " +
      state.log
        .slice(-2)
        .map((entry) => entry.text)
        .join(" / "),
  );
}
// The game as saved at a prompt must load back unchanged: migrate (and its validator) accept what the app writes.
// Checked at every SAVE_CHECK_EVERY-th prompt (a counter, not the game's random numbers) and at the end of each game:
// at every prompt it multiplies the run time.
const SAVE_CHECK_EVERY = 7;
let promptsSeen = 0;
function checkSaveLoads(state, tag) {
  const saved = JSON.stringify(state);
  let loaded;
  try {
    loaded = JSON.stringify(engine.migrate(JSON.parse(saved)));
  } catch (error) {
    loaded = error.message;
  }
  if (loaded === saved) return true;
  recordProblem(
    "SAVE DOES NOT LOAD BACK",
    tag +
      " " +
      state.walk?.page +
      "." +
      state.walk?.node +
      " " +
      loaded.slice(0, 80),
  );
  return false;
}
// The invariants, checked around every answer of every walk.
const INVARIANTS = {
  onWalkStart: (state) => {
    expectedTotals = cardTotals(state);
  },
  onPrompt: (state, tag) =>
    checkPromptPresent(state, tag) &&
    (++promptsSeen % SAVE_CHECK_EVERY !== 0 || checkSaveLoads(state, tag)),
  afterAnswer: checkCardConservation,
};
function main() {
  let gameNumber = 0;
  for (let bits = 0; bits < SETTING_COMBINATIONS; bits++) {
    const settings = settingsFromBits(bits);
    for (let i = 0; i < GAMES_PER_SETTING; i++) {
      const state = game(settings, gameNumber++, INVARIANTS);
      digest.update(JSON.stringify(state));
      checkSaveLoads(state, "end of game");
    }
  }
  console.log("games:", gameNumber);
  if (wantDigest) console.log("digest:", digest.digest("hex"));
  process.exit(reportProblems() ? 0 : 1);
}
main();
