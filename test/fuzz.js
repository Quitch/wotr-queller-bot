// Random games across every setting combination: exceptions, walks left without a prompt, runaway walks and card-count
// conservation are reported; a seed reproduces a run. Exit 1 on any problem.
import crypto from "node:crypto";
import { QB as engine } from "./load.js";
const { PROMPT, PHASE, WALK_RESULT, DIE_STATE, CARD_EFFECT } = engine;
const cardById = engine.cardById;
// Math.random is replaced by this linear congruential generator so that a seed reproduces a run exactly (the engine takes
// all its randomness from Math.random).
const LCG = { MULTIPLIER: 1103515245, INCREMENT: 12345, MASK: 0x7fffffff };
let seed = +process.argv[2] || 1;
const rnd = () => {
  seed = (seed * LCG.MULTIPLIER + LCG.INCREMENT) & LCG.MASK;
  return seed / LCG.MASK;
};
Math.random = rnd;
// --digest: print a sha1 over every final game state, so a refactor that
// should not change behaviour can be checked against a recorded hash
const wantDigest = process.argv.includes("--digest");
const digest = crypto.createHash("sha1");
const SETTING_COMBINATIONS = 16; // every on/off combination of the four settings
const GAMES_PER_SETTING = 25;
const TURNS_PER_GAME = 4;
const MAX_PROMPTS_PER_WALK = 400;
const PHASE5_WALKS_WITHOUT_DICE = 12; // with dice off nothing runs out, so Phase 5 stops after this many walks
const PHASE5_WALK_LIMIT = 60; // with dice on the dice must run out well before this
const CHANCE = {
  YES: 0.5,
  ACTION_DONE: 0.8,
  STEP_DONE: 0.85,
  RANDOM_BOARD_AT_TURN_START: 0.7,
  BATTLE_AFTER_WALK: 0.25,
  RANDOM_BOARD_AFTER_WALK: 0.3,
  FLAG_ON: 0.4,
  REVEALED: 0.3,
  MORDOR: 0.2,
  IN_FP_SETTLEMENT: 0.4,
  AT_START: 0.2,
};
// Upper bounds (exclusive) for the random board values.
const BOARD_RANGE = {
  PROGRESS: 8,
  COMPANIONS: 8,
  SHADOW_NATION_STEPS: 4,
  NAZGUL: 9,
  SHADOW_VP: 10,
  CORRUPTION: 12,
  RINGS: 4,
  NAZGUL_LEADERSHIP: 3,
};
const problems = {};
// Count a problem by kind, keeping the first example seen.
const recordProblem = (kind, example) => {
  problems[kind] = problems[kind] || { count: 0, example };
  problems[kind].count++;
};
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
const coinFlip = () => rnd() < CHANCE.YES;
function randomBattleForm() {
  return {
    nazLead: Math.floor(rnd() * BOARD_RANGE.NAZGUL_LEADERSHIP),
    shadowElite: coinFlip(),
    seElite: coinFlip(),
    isengardStronghold: coinFlip(),
    defInFs: coinFlip(),
    nearMoria: coinFlip(),
    figures: {
      corsairs: coinFlip(),
      dunlendings: coinFlip(),
      spiders: coinFlip(),
    },
    underSiege: coinFlip(),
    attackingSiege: coinFlip(),
  };
}
function randomAnswer(state) {
  const prompt = state.walk.prompt;
  switch (prompt.type) {
    case PROMPT.YES_NO:
    case PROMPT.SITUATIONAL:
    case PROMPT.CONFIRM:
    case PROMPT.DIE_CHECK:
    case PROMPT.RING:
      return coinFlip();
    case PROMPT.COUNT:
      return Math.floor(prompt.min + rnd() * (prompt.max - prompt.min + 1));
    case PROMPT.CHOICE:
      return prompt.options[Math.floor(rnd() * prompt.options.length)].value;
    case PROMPT.ACTION:
      return rnd() < CHANCE.ACTION_DONE ? "done" : "no";
    case PROMPT.PLAY_CARD:
      return "done";
    case PROMPT.STEP:
      return rnd() < CHANCE.STEP_DONE ? "done" : "no";
    case PROMPT.ROLL:
      return prompt.options[Math.floor(rnd() * prompt.options.length)];
    case PROMPT.PRIORITY:
      return "ok";
    case PROMPT.BATTLE_FORM:
      return randomBattleForm();
  }
  throw new Error("unknown prompt " + prompt.type);
}
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
// Answer the open prompt at random; false when the engine threw.
function answerPrompt(state, tag) {
  try {
    engine.answer(state, randomAnswer(state));
    return true;
  } catch (error) {
    recordProblem(
      "EXCEPTION " + error.message,
      tag + " " + error.stack.split("\n")[1],
    );
    return false;
  }
}
// The played card's effect reshuffles the Faction deck, which may legitimately change the totals.
const reshufflesFactionDeck = (prompt) =>
  prompt.type === PROMPT.PLAY_CARD &&
  [CARD_EFFECT.SERVANTS, CARD_EFFECT.HIS_WILL].includes(
    cardById[prompt.card]?.effect,
  );
// The card counts after an answer must match the ones before it; returns the totals to compare the next answer against.
function checkCardConservation(state, tag, expected, prompt) {
  const now = cardTotals(state);
  if (sameTotals(now, expected)) return expected;
  if (reshufflesFactionDeck(prompt)) return now;
  recordProblem(
    "CARD TOTAL CHANGED " + totalsText(expected) + "->" + totalsText(now),
    tag +
      " " +
      state.log
        .slice(-2)
        .map((entry) => entry.text)
        .join(" / "),
  );
  return expected;
}
// Answer prompts at random until the walk is done; false when it had to stop on a problem.
function driveWalk(state, tag) {
  let prompts = 0;
  let totals = cardTotals(state);
  while (state.walk && !state.walk.done) {
    if (!checkPromptPresent(state, tag)) return false;
    const prompt = state.walk.prompt;
    if (!answerPrompt(state, tag)) return false;
    totals = checkCardConservation(state, tag, totals, prompt);
    if (++prompts > MAX_PROMPTS_PER_WALK) {
      recordProblem(
        "RUNAWAY prompts in one walk",
        tag + " " + state.walk.page + "." + state.walk.node,
      );
      return false;
    }
  }
  return true;
}
function randomBoard(state) {
  const board = state.board;
  board.fs.progress = Math.floor(rnd() * BOARD_RANGE.PROGRESS);
  board.fs.revealed = rnd() < CHANCE.REVEALED;
  board.fs.mordor = rnd() < CHANCE.MORDOR;
  board.fs.inFPSettlement = rnd() < CHANCE.IN_FP_SETTLEMENT;
  board.fs.atStart = rnd() < CHANCE.AT_START;
  board.fs.companions = Math.floor(rnd() * BOARD_RANGE.COMPANIONS);
  for (const key in board.chars) board.chars[key] = rnd() < CHANCE.FLAG_ON;
  for (const key of engine.SHADOW_NATIONS)
    board.nations[key] = Math.floor(rnd() * BOARD_RANGE.SHADOW_NATION_STEPS);
  const stances = Object.values(engine.FP_STANCE);
  for (const key of engine.FP_NATIONS)
    board.nations[key] = stances[Math.floor(rnd() * stances.length)];
  for (const key in board.factions)
    board.factions[key] = rnd() < CHANCE.FLAG_ON;
  board.nazgul = Math.floor(rnd() * BOARD_RANGE.NAZGUL);
  board.shadowVP = Math.floor(rnd() * BOARD_RANGE.SHADOW_VP);
  board.corruption = Math.floor(rnd() * BOARD_RANGE.CORRUPTION);
  board.rings = Math.floor(rnd() * BOARD_RANGE.RINGS);
}
function playSetup(state, tag) {
  engine.startPhase(state, PHASE.SETUP);
  return driveWalk(state, tag + " setup");
}
function playPhases1to4(state, tag) {
  for (const phase of [PHASE.P1, PHASE.P2, PHASE.P3, PHASE.P4]) {
    engine.startPhase(state, phase);
    if (state.walk && !driveWalk(state, tag + " " + phase)) return false;
  }
  return true;
}
// Sometimes a battle after a Phase 5 walk, with a second round when the first says so.
function maybeBattle(state, tag) {
  if (rnd() >= CHANCE.BATTLE_AFTER_WALK) return true;
  engine.startBattle(state, 1);
  if (!driveWalk(state, tag + " battle1")) return false;
  if (state.walk.result === WALK_RESULT.BATTLE_NEXT) {
    engine.startBattle(state, 2);
    if (!driveWalk(state, tag + " battle2")) return false;
  }
  return true;
}
const usableDice = (state) =>
  state.dice.pool.filter(
    (die) =>
      die.status === DIE_STATE.AVAIL || die.status === DIE_STATE.RESERVED,
  ).length;
// Phase 5: walk until the dice are gone (dice on) or a fixed number of walks (dice off).
function playPhase5(state, tag) {
  const diceOn = state.settings.dice;
  let walks = 0;
  while (true) {
    const left = diceOn ? usableDice(state) : null;
    if (diceOn && left === 0) break;
    if (!diceOn && walks >= PHASE5_WALKS_WITHOUT_DICE) break;
    if (walks > PHASE5_WALK_LIMIT) {
      recordProblem(
        "PHASE 5 NEVER ENDS",
        tag +
          " left=" +
          left +
          " pool=" +
          JSON.stringify(
            state.dice.pool.map((die) => die.face + "/" + die.status),
          ) +
          " last=" +
          state.walk.result,
      );
      break;
    }
    engine.startPhase(state, PHASE.P5);
    if (!driveWalk(state, tag + " p5#" + walks)) return false;
    walks++;
    if (!maybeBattle(state, tag)) return false;
    if (rnd() < CHANCE.RANDOM_BOARD_AFTER_WALK) randomBoard(state);
  }
  return true;
}
// One game: setup, then TURNS_PER_GAME turns of every phase; returns the final state (early when a problem stopped it).
function game(settings, gameNumber) {
  const state = engine.newState(settings);
  const gameTag = JSON.stringify(settings) + " g" + gameNumber;
  if (!playSetup(state, gameTag)) return state;
  for (let turn = 0; turn < TURNS_PER_GAME; turn++) {
    const tag = gameTag + " T" + state.turn;
    if (rnd() < CHANCE.RANDOM_BOARD_AT_TURN_START) randomBoard(state);
    if (!playPhases1to4(state, tag)) return state;
    if (!playPhase5(state, tag)) return state;
    engine.nextTurn(state);
  }
  return state;
}
// The setting combinations, one per bit pattern.
function settingsFromBits(bits) {
  return {
    dice: !!(bits & 1),
    cards: !!(bits & 2),
    tracker: !!(bits & 4),
    wome: !!(bits & 8),
  };
}
function main() {
  let gameNumber = 0;
  for (let bits = 0; bits < SETTING_COMBINATIONS; bits++) {
    const settings = settingsFromBits(bits);
    for (let i = 0; i < GAMES_PER_SETTING; i++)
      digest.update(JSON.stringify(game(settings, gameNumber++)));
  }
  console.log("games:", gameNumber);
  if (wantDigest) console.log("digest:", digest.digest("hex"));
  for (const kind in problems)
    console.log(
      problems[kind].count + "x",
      kind,
      "\n   e.g.",
      problems[kind].example,
    );
  process.exit(Object.keys(problems).length ? 1 : 0);
}
main();
