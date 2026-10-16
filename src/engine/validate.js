// The last step of migrate: a save is refused unless every field the page writes into its HTML as it is, or uses to
// index the dice pool, the cards or the flowchart, holds what the app itself writes there. Numbers are clamped.
import { FLOW, NODE_KIND } from "../flow/index.js";
import { cardById } from "./cards.js";
import {
  DEFAULT_STEP_LIMIT,
  DIE_KIND,
  DIE_REQUIREMENT,
  DIE_STATE,
  FACE,
  PHASE,
  STEP_LIMITS,
  STRATEGY,
  TRAIL,
} from "./constants.js";

const TURN_LIMIT = [1, DEFAULT_STEP_LIMIT[1]];
const valuesOf = (values) => new Set(Object.values(values));
const PHASES = valuesOf(PHASE),
  STRATEGIES = valuesOf(STRATEGY),
  DIE_KINDS = valuesOf(DIE_KIND),
  DIE_STATES = valuesOf(DIE_STATE),
  FACES = valuesOf(FACE),
  DIE_REQUIREMENTS = valuesOf(DIE_REQUIREMENT),
  TRAIL_KINDS = valuesOf(TRAIL),
  NODE_KINDS = valuesOf(NODE_KIND);

function check(ok, field) {
  if (!ok) throw new Error("not a Queller save (" + field + ")");
}
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isCard = (id) => typeof id === "string" && Object.hasOwn(cardById, id);
const isPage = (page) => typeof page === "string" && Object.hasOwn(FLOW, page);
const isNode = (page, node) =>
  isPage(page) &&
  typeof node === "string" &&
  Object.hasOwn(FLOW[page].nodes, node);
const optional = (value, test) => value == null || test(value);
function integer(value, [min, max], field) {
  check(typeof value === "number" && !Number.isNaN(value), field);
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
function checkCardList(list, field) {
  check(Array.isArray(list) && list.every(isCard), field);
}
// A pile of piles (the decks, the discards): each one a list of card ids.
function checkCardPiles(piles, field) {
  check(isObject(piles), field);
  for (const [key, list] of Object.entries(piles))
    checkCardList(list, field + "." + key);
}
function checkCards(cards) {
  check(isObject(cards), "cards");
  checkCardPiles(cards.decks, "cards.decks");
  checkCardPiles(cards.discards, "cards.discards");
  for (const key of ["hand", "factionHand", "table", "factionTable"])
    checkCardList(cards[key], "cards." + key);
}
function checkDice(dice) {
  check(isObject(dice) && Array.isArray(dice.pool), "dice");
  for (const die of dice.pool)
    check(
      isObject(die) &&
        DIE_KINDS.has(die.kind) &&
        DIE_STATES.has(die.status) &&
        optional(die.face, (face) => FACES.has(face)),
      "dice.pool",
    );
}
// The tracker numbers (STEP_LIMITS paths such as "fs.progress"), clamped to their range.
function checkBoard(board) {
  check(isObject(board.fs) && isObject(board.nations), "board");
  for (const [path, limits] of Object.entries(STEP_LIMITS)) {
    const keys = path.split(".");
    const key = keys.pop();
    const holder = keys.reduce((object, step) => object[step], board);
    holder[key] = integer(holder[key], limits, "board." + path);
  }
}
function checkLog(log) {
  check(Array.isArray(log), "log");
  for (const entry of log) {
    check(isObject(entry), "log");
    entry.turn = integer(entry.turn, TURN_LIMIT, "log.turn");
  }
}
const isPoolIndex = (index, pool) =>
  index == null ||
  (Number.isInteger(index) && index >= 0 && index < pool.length);
function checkTrail(trail) {
  check(Array.isArray(trail), "walk.trail");
  for (const entry of trail)
    check(
      isObject(entry) &&
        TRAIL_KINDS.has(entry.kind) &&
        optional(entry.card, isCard),
      "walk.trail",
    );
}
function checkPrompt(prompt) {
  if (prompt == null) return;
  check(
    isObject(prompt) &&
      optional(prompt.kind, (kind) => NODE_KINDS.has(kind)) &&
      optional(prompt.card, isCard),
    "walk.prompt",
  );
}
// Where the walk stands, the pages it returns to, the dice it holds and the cards it is choosing among.
function checkWalk(walk, pool) {
  check(isObject(walk), "walk");
  check(
    isObject(walk.entry) &&
      isPage(walk.entry.page) &&
      typeof walk.entry.start === "string",
    "walk.entry",
  );
  check(isNode(walk.page, walk.node), "walk.node");
  check(Array.isArray(walk.stack ?? []), "walk.stack");
  for (const frame of walk.stack ?? [])
    check(
      isObject(frame) &&
        isNode(frame.page, frame.node) &&
        optional(frame.die, (die) => DIE_REQUIREMENTS.has(die)) &&
        isPoolIndex(frame.dieIndex, pool),
      "walk.stack",
    );
  check(
    optional(walk.die, (die) => DIE_REQUIREMENTS.has(die)) &&
      isPoolIndex(walk.dieIndex, pool) &&
      isPoolIndex(walk.reservedDieIndex, pool) &&
      optional(walk.ringPending, isObject) &&
      isPoolIndex(walk.ringPending?.dieIndex, pool),
    "walk.dieIndex",
  );
  checkTrail(walk.trail);
  checkPrompt(walk.prompt);
  for (const key of ["cands", "ctb", "discards"])
    if (walk[key] != null) checkCardList(walk[key], "walk." + key);
  check(optional(walk.chosen, isCard), "walk.chosen");
}
export function validateSave(save) {
  check(
    isObject(save) && isObject(save.settings) && isObject(save.board),
    "settings",
  );
  save.turn = integer(save.turn, TURN_LIMIT, "turn");
  check(PHASES.has(save.phase), "phase");
  check(
    optional(save.strategy, (strategy) => STRATEGIES.has(strategy)),
    "strategy",
  );
  checkDice(save.dice);
  checkCards(save.cards);
  checkBoard(save.board);
  checkLog(save.log);
  if (save.battle != null) {
    check(isObject(save.battle), "battle");
    if (save.battle.nazLead !== undefined)
      save.battle.nazLead = integer(
        save.battle.nazLead,
        STEP_LIMITS.nazgul,
        "battle.nazLead",
      );
  }
  if (save.walk != null) checkWalk(save.walk, save.dice.pool);
  return save;
}
