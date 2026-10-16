// Random games across every setting combination (the driver is test/play.js): exceptions, walks left without a prompt,
// runaway walks, card-count conservation over the whole game and the state invariants (dice, hand sizes, Elven Rings,
// a finished walk's result) are reported; a seed reproduces a run. Exit 1 on any problem.
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
const { PROMPT, CARD_EFFECT, DIE_KIND, DIE_STATE, FACE, HAND, HAND_LIMIT } =
  engine;
const cardById = engine.cardById;
// node test/fuzz.js [seed] [--digest], in either order; the seed is any integer (default 1) and is printed first, so a
// failing run can be repeated. --digest prints a sha256 over every final game state, so a refactor that should not
// change behaviour can be checked against a recorded hash.
const args = process.argv.slice(2);
const seedArgument = args.find((arg) => !arg.startsWith("--"));
const seed = seedArgument === undefined ? 1 : Number(seedArgument);
if (!Number.isInteger(seed)) {
  console.log("the seed must be an integer, not " + seedArgument);
  process.exit(1);
}
seedRandom(seed);
console.log("seed:", seed);
const wantDigest = args.includes("--digest");
const digest = crypto.createHash("sha256");
const GAMES_PER_SETTING = 25;
const MAX_RINGS = 3;
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
const lastLogText = (state) =>
  state.log
    .slice(-2)
    .map((entry) => entry.text)
    .join(" / ");
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
  prompt?.type === PROMPT.PLAY_CARD &&
  [CARD_EFFECT.SERVANTS, CARD_EFFECT.HIS_WILL].includes(
    cardById[prompt.card]?.effect,
  );
// The card counts must stay what the game started with (one running total per game, so a change between walks, in
// nextTurn or startBattle, shows at the next check too).
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
    tag + " " + lastLogText(state),
  );
  expectedTotals = now;
}
const poolText = (state) =>
  JSON.stringify(state.dice.pool.map((die) => die.face + "/" + die.status));
const DIE_STATES = new Set(Object.values(DIE_STATE));
const DIE_KINDS = new Set(Object.values(DIE_KIND));
// The pool only changes size when the dice are recovered, which builds a new pool array.
let expectedPool = { pool: null, size: 0 };
// With dice on: the pool keeps its size, every die has a known kind and status, the Hunt count matches the dice in the
// Hunt box, and a die is set aside for a minion exactly when minionReserved says so (rule 34).
function checkDice(state, tag) {
  if (!state.settings.dice) return;
  const dice = state.dice;
  const where = () =>
    tag + " pool=" + poolText(state) + " " + lastLogText(state);
  if (dice.pool !== expectedPool.pool)
    expectedPool = { pool: dice.pool, size: dice.pool.length };
  else if (dice.pool.length !== expectedPool.size)
    recordProblem(
      "DICE POOL SIZE CHANGED " + expectedPool.size + "->" + dice.pool.length,
      where(),
    );
  if (
    dice.pool.some(
      (die) => !DIE_STATES.has(die.status) || !DIE_KINDS.has(die.kind),
    )
  )
    recordProblem("DIE WITH UNKNOWN STATUS OR KIND", where());
  if (
    dice.pool.some(
      (die) => die.status === DIE_STATE.HUNT && die.face !== FACE.EYE,
    )
  )
    recordProblem("HUNT DIE NOT AN EYE", where());
  const inHunt = dice.pool.filter(
    (die) => die.status === DIE_STATE.HUNT,
  ).length;
  if (dice.hunt !== inHunt)
    recordProblem(
      "HUNT COUNT " + dice.hunt + " BUT " + inHunt + " DICE IN THE HUNT BOX",
      where(),
    );
  const setAside = dice.pool.some((die) => die.status === DIE_STATE.RESERVED);
  if (setAside !== !!state.minionReserved)
    recordProblem(
      "minionReserved " +
        !!state.minionReserved +
        " BUT A DIE SET ASIDE " +
        setAside,
      where(),
    );
}
function checkRings(state, tag) {
  const rings = state.board.rings;
  if (!Number.isInteger(rings) || rings < 0 || rings > MAX_RINGS)
    recordProblem("ELVEN RINGS OUT OF RANGE " + rings, tag);
}
// Checked when a walk is done (a draw step may go over the limit until its discard step): the hands are within the
// limit, and the walk says how it ended.
function checkWalkEnd(state, tag) {
  const cards = state.cards;
  if (cards.hand.length > HAND_LIMIT[HAND.EVENT])
    recordProblem(
      "EVENT HAND OVER THE LIMIT " + cards.hand.length,
      tag + " " + lastLogText(state),
    );
  if (cards.factionHand.length > HAND_LIMIT[HAND.FACTION])
    recordProblem(
      "FACTION HAND OVER THE LIMIT " + cards.factionHand.length,
      tag,
    );
  if (state.walk && !state.walk.result)
    recordProblem(
      "WALK DONE WITHOUT A RESULT",
      tag + " " + state.walk.page + "." + state.walk.node,
    );
}
// Every invariant; the problems are recorded, never returned, so a game always plays to its end.
function checkState(state, tag, prompt) {
  checkCardConservation(state, tag, prompt);
  checkDice(state, tag);
  checkRings(state, tag);
  if (!state.walk || state.walk.done) checkWalkEnd(state, tag);
}
// The invariants, checked around every answer of every walk and after every phase.
const INVARIANTS = {
  onGameStart: (state) => {
    expectedTotals = cardTotals(state);
    expectedPool = { pool: null, size: 0 };
  },
  onWalkStart: (state, tag) => checkState(state, tag, null),
  onPrompt: checkPromptPresent,
  afterAnswer: checkState,
  afterPhase: (state, tag) => checkState(state, tag, null),
};
function main() {
  let gameNumber = 0;
  for (let bits = 0; bits < SETTING_COMBINATIONS; bits++) {
    const settings = settingsFromBits(bits);
    for (let i = 0; i < GAMES_PER_SETTING; i++)
      digest.update(JSON.stringify(game(settings, gameNumber++, INVARIANTS)));
  }
  console.log("games:", gameNumber);
  if (wantDigest) console.log("digest:", digest.digest("hex"));
  process.exit(reportProblems() ? 0 : 1);
}
main();
