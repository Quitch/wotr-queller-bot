// The random game driver the fuzz and render tests share: a seeded Math.random, a random answer to every prompt, random
// board states, and a game of a few turns for one setting combination. Problems the driver itself sees (an exception,
// a runaway walk, a Phase 5 that never ends) are counted by kind with the first example; a test adds its own checks
// through the hooks of game().
import { QB as engine } from "./load.js";
const { PROMPT, PHASE, WALK_RESULT, DIE_STATE } = engine;
// Math.random is replaced by this linear congruential generator so that a seed reproduces a run exactly (the engine takes
// all its randomness from Math.random).
const LCG = { MULTIPLIER: 1103515245, INCREMENT: 12345, MASK: 0x7fffffff };
let seed = 1;
export const rnd = () => {
  // Math.imul keeps the product exact; a plain * lost bits above 2^53 and the sequence cycled after about 10,000 draws
  seed = (Math.imul(seed, LCG.MULTIPLIER) + LCG.INCREMENT) & LCG.MASK;
  return seed / (LCG.MASK + 1);
};
// Seed the generator and make it the engine's Math.random.
export function seedRandom(value) {
  seed = value;
  Math.random = rnd;
}
export const SETTING_COMBINATIONS = 16; // every on/off combination of the four settings
export const TURNS_PER_GAME = 4;
const MAX_PROMPTS_PER_WALK = 400;
const PHASE5_WALKS_WITHOUT_DICE = 12; // with dice off nothing runs out, so Phase 5 stops after this many walks
const PHASE5_WALK_LIMIT = 60; // with dice on the dice must run out well before this
// After this many Phase 5 walks every Pass is refused: a real game bounds the passes by the Free Peoples' dice, which the
// driver does not model, and a die that only a refused Pass spends would otherwise outlast the limit now and then.
const PHASE5_WALKS_BEFORE_REFUSING_PASS = 30;
let refusePass = false;
const CHANCE = {
  YES: 0.5,
  ACTION_DONE: 0.8,
  STEP_DONE: 0.85,
  BLOCKED_BY_CARD: 0.3,
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
export const problems = {};
// Count a problem by kind, keeping the first example seen.
export const recordProblem = (kind, example) => {
  problems[kind] = problems[kind] || { count: 0, example };
  problems[kind].count++;
};
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
const pickOne = (values) => values[Math.floor(rnd() * values.length)];
// An action carried out: the first move of an Army die may also move a second Army or attack (rule 9), as the UI offers.
function actionDone(prompt) {
  if (!prompt.armyMove) return "done";
  return pickOne(
    prompt.moveOrAttack
      ? ["done", "movedBoth", "attacked"]
      : ["done", "movedBoth"],
  );
}
const onlyReservedDiceLeft = (state) =>
  state.settings.dice &&
  state.dice.pool.some((die) => die.status === DIE_STATE.RESERVED) &&
  !state.dice.pool.some((die) => die.status === DIE_STATE.AVAIL);
export function randomAnswer(state) {
  const prompt = state.walk.prompt;
  switch (prompt.type) {
    case PROMPT.YES_NO:
    case PROMPT.SITUATIONAL:
    case PROMPT.CONFIRM:
    case PROMPT.DIE_CHECK:
    case PROMPT.RING:
      return coinFlip();
    case PROMPT.CHOICE:
      return prompt.options[Math.floor(rnd() * prompt.options.length)].value;
    case PROMPT.ACTION:
      // only refusing the pass spends a die set aside for a minion, so passing with nothing else left never ends Phase 5
      if (prompt.pass && (refusePass || onlyReservedDiceLeft(state)))
        return "no";
      return rnd() < CHANCE.ACTION_DONE ? actionDone(prompt) : "no";
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
    case PROMPT.BLOCKED:
      return rnd() < CHANCE.BLOCKED_BY_CARD
        ? pickOne(engine.FP_PROTECTION_CARDS).key
        : "no";
  }
  throw new Error("unknown prompt " + prompt.type);
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
// Answer prompts at random until the walk is done, then do what the app does after a walk (afterWalk: the phase and
// the open battle); false when it had to stop on a problem. The hooks run around every answer: onWalkStart(state, tag)
// once, onPrompt(state, tag) before each answer and afterAnswer(state, tag, prompt) after it; onPrompt and afterAnswer
// stop the walk by returning false.
function driveWalk(state, tag, hooks) {
  let prompts = 0;
  hooks.onWalkStart?.(state, tag);
  while (state.walk && !state.walk.done) {
    if (hooks.onPrompt?.(state, tag) === false) return false;
    const prompt = state.walk.prompt;
    if (!answerPrompt(state, tag)) return false;
    if (hooks.afterAnswer?.(state, tag, prompt) === false) return false;
    if (++prompts > MAX_PROMPTS_PER_WALK) {
      recordProblem(
        "RUNAWAY prompts in one walk",
        tag + " " + state.walk.page + "." + state.walk.node,
      );
      return false;
    }
  }
  engine.afterWalk(state);
  return true;
}
export function randomBoard(state) {
  const board = state.board;
  board.fs.progress = Math.floor(rnd() * BOARD_RANGE.PROGRESS);
  board.fs.revealed = rnd() < CHANCE.REVEALED;
  board.fs.mordor = rnd() < CHANCE.MORDOR;
  board.fs.inFPSettlement = rnd() < CHANCE.IN_FP_SETTLEMENT;
  board.fs.atStart = rnd() < CHANCE.AT_START;
  board.fs.companions = Math.floor(rnd() * BOARD_RANGE.COMPANIONS);
  const minionStatuses = Object.values(engine.MINION_STATUS);
  for (const key in board.chars)
    board.chars[key] = engine.MINIONS.includes(key)
      ? minionStatuses[Math.floor(rnd() * minionStatuses.length)]
      : rnd() < CHANCE.FLAG_ON;
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
function playSetup(state, tag, hooks) {
  engine.startPhase(state, PHASE.SETUP);
  return driveWalk(state, tag + " setup", hooks);
}
function playPhases1to4(state, tag, hooks) {
  for (const phase of [PHASE.P1, PHASE.P2, PHASE.P3, PHASE.P4]) {
    engine.startPhase(state, phase);
    if (state.walk && !driveWalk(state, tag + " " + phase, hooks)) return false;
    hooks.afterPhase?.(state, tag + " " + phase);
  }
  return true;
}
// Sometimes a battle after a Phase 5 walk, with a second round when the first says so.
function maybeBattle(state, tag, hooks) {
  if (rnd() >= CHANCE.BATTLE_AFTER_WALK) return true;
  engine.startBattle(state, 1);
  if (!driveWalk(state, tag + " battle1", hooks)) return false;
  if (state.walk.result === WALK_RESULT.BATTLE_NEXT) {
    engine.startBattle(state, 2);
    if (!driveWalk(state, tag + " battle2", hooks)) return false;
  }
  return true;
}
const usableDice = (state) =>
  state.dice.pool.filter(
    (die) =>
      die.status === DIE_STATE.AVAIL || die.status === DIE_STATE.RESERVED,
  ).length;
// Phase 5: walk until the dice are gone (dice on) or a fixed number of walks (dice off).
function playPhase5(state, tag, hooks) {
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
    refusePass = walks >= PHASE5_WALKS_BEFORE_REFUSING_PASS;
    engine.startPhase(state, PHASE.P5);
    const walked = driveWalk(state, tag + " p5#" + walks, hooks);
    refusePass = false;
    if (!walked) return false;
    walks++;
    if (!maybeBattle(state, tag, hooks)) return false;
    if (rnd() < CHANCE.RANDOM_BOARD_AFTER_WALK) randomBoard(state);
  }
  return true;
}
// One game: setup, then `turns` turns of every phase; returns the final state (early when a problem stopped it).
// hooks: see driveWalk, plus onGameStart(state) on the new game and afterPhase(state, tag) after each phase of a turn.
export function game(settings, gameNumber, hooks = {}, turns = TURNS_PER_GAME) {
  const state = engine.newState(settings);
  const gameTag = JSON.stringify(settings) + " g" + gameNumber;
  hooks.onGameStart?.(state);
  if (!playSetup(state, gameTag, hooks)) return state;
  for (let turn = 0; turn < turns; turn++) {
    const tag = gameTag + " T" + state.turn;
    if (rnd() < CHANCE.RANDOM_BOARD_AT_TURN_START) randomBoard(state);
    if (!playPhases1to4(state, tag, hooks)) return state;
    if (!playPhase5(state, tag, hooks)) return state;
    hooks.afterPhase?.(state, tag + " p5");
    engine.nextTurn(state);
  }
  return state;
}
// The setting combinations, one per bit pattern.
export function settingsFromBits(bits) {
  return {
    dice: !!(bits & 1),
    cards: !!(bits & 2),
    tracker: !!(bits & 4),
    wome: !!(bits & 8),
  };
}
// Print the problems recorded, one line per kind; true when there were none.
export function reportProblems() {
  for (const kind in problems)
    console.log(
      problems[kind].count + "x",
      kind,
      "\n   e.g.",
      problems[kind].example,
    );
  return Object.keys(problems).length === 0;
}
