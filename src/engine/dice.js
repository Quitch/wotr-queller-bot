// The dice: recovering, the Hunt box, rolling, finding and spending a die, and the Elven Ring change.
import { huntCap, minionInPlay, shadowFactionInPlay } from "./board.js";
import {
  BASE_ACTION_DICE,
  DIE_KIND,
  DIE_REQUIREMENT,
  DIE_STATE,
  FACE,
  MINIONS,
  STRATEGY,
  isFactionRequirement,
} from "./constants.js";
import { log } from "./log.js";
import { pick, randomBelow } from "./random.js";

export const SHADOW_FACES = [
  FACE.MUSTER,
  FACE.ARMY_MUSTER,
  FACE.ARMY,
  FACE.CHARACTER,
  FACE.EVENT,
  FACE.EYE,
];
export const FACTION_FACES = [
  FACE.RECRUIT,
  FACE.PLAY_DRAW,
  FACE.RECRUIT_PLAY,
  FACE.RECRUIT_DRAW,
  FACE.EYE,
  FACE.WILD,
];
export function diceCount(state) {
  return (
    BASE_ACTION_DICE + MINIONS.filter((key) => minionInPlay(state, key)).length
  );
}
export function recoverDice(state) {
  const count = diceCount(state);
  state.dice.pool = [];
  state.dice.hunt = 0;
  for (let i = 0; i < count; i++)
    state.dice.pool.push({
      kind: DIE_KIND.ACTION,
      face: null,
      status: DIE_STATE.POOL,
    });
  // WoME p.8: the Faction die joins the pool at the start of the turn after the first Shadow Faction enters play, and leaves it the turn after the last one is gone.
  state.dice.factionDie = shadowFactionInPlay(state);
  if (state.dice.factionDie)
    state.dice.pool.push({
      kind: DIE_KIND.FACTION,
      face: null,
      status: DIE_STATE.POOL,
    });
  state.minionReserved = false;
  state.ringUsedThisTurn = false;
  state.situational = {};
  state.playable = {};
  log(
    state,
    "Recovered " +
      count +
      " action dice" +
      (state.dice.factionDie ? " and the Faction die" : "") +
      ".",
  );
}
export function assignHunt(state, requested) {
  const pool = state.dice.pool.filter(
    (die) => die.kind === DIE_KIND.ACTION && die.status === DIE_STATE.POOL,
  );
  const cap = huntCap(state),
    placed = Math.min(requested, cap, pool.length);
  for (let i = 0; i < placed; i++) {
    pool[i].status = DIE_STATE.HUNT;
    pool[i].face = FACE.EYE;
  }
  state.dice.hunt += placed;
  log(
    state,
    "Placed " +
      placed +
      " " +
      (placed === 1 ? "die" : "dice") +
      " in the Hunt box before rolling" +
      (placed < requested && cap < requested
        ? " (rule 34: maximum " +
          cap +
          " for " +
          (state.board.fs.companions ?? 0) +
          " Companions)"
        : "") +
      ".",
  );
  return placed;
}
export function rollRemaining(state) {
  let eyes = 0;
  const out = [];
  for (const die of state.dice.pool) {
    if (die.status !== DIE_STATE.POOL) continue;
    die.face =
      die.kind === DIE_KIND.ACTION ? pick(SHADOW_FACES) : pick(FACTION_FACES);
    if (die.face === FACE.EYE) {
      die.status = DIE_STATE.HUNT;
      state.dice.hunt++;
      eyes++;
    } else die.status = DIE_STATE.AVAIL;
    out.push(die.face);
  }
  let hunt = "";
  if (eyes)
    hunt = " — " + eyes + " Eye" + (eyes > 1 ? "s" : "") + " to the Hunt box";
  log(state, "Rolled: " + out.join(", ") + hunt + ".");
  return out;
}
export function preferredFaces(state) {
  return state.strategy === STRATEGY.CORRUPTION
    ? [FACE.CHARACTER]
    : [FACE.ARMY, FACE.MUSTER, FACE.ARMY_MUSTER];
}
// which available dice satisfy a requirement
export const DIE_REQUIREMENT_FACES = {
  [DIE_REQUIREMENT.ARMY]: [FACE.ARMY, FACE.ARMY_MUSTER, FACE.WILD],
  [DIE_REQUIREMENT.MUSTER]: [FACE.MUSTER, FACE.ARMY_MUSTER, FACE.WILD],
  [DIE_REQUIREMENT.CHARACTER]: [FACE.CHARACTER, FACE.WILD],
  [DIE_REQUIREMENT.EVENT]: [FACE.EVENT, FACE.WILD],
  [DIE_REQUIREMENT.CHAR_OR_MUSTER]: [
    FACE.CHARACTER,
    FACE.MUSTER,
    FACE.ARMY_MUSTER,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_RECRUIT]: [
    FACE.RECRUIT,
    FACE.RECRUIT_PLAY,
    FACE.RECRUIT_DRAW,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_PLAY]: [
    FACE.PLAY_DRAW,
    FACE.RECRUIT_PLAY,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_DRAW]: [
    FACE.PLAY_DRAW,
    FACE.RECRUIT_DRAW,
    FACE.WILD,
  ],
};
// Does a die already held for `have` satisfy a step that needs `need`?
export function dieSatisfies(have, need) {
  return (
    !!have &&
    (have === need ||
      (need === DIE_REQUIREMENT.CHAR_OR_MUSTER &&
        (have === DIE_REQUIREMENT.CHARACTER ||
          have === DIE_REQUIREMENT.MUSTER)))
  );
}
export function availableDice(state) {
  return state.dice.pool.filter((die) => die.status === DIE_STATE.AVAIL);
}
export function findDie(state, req) {
  const faces = DIE_REQUIREMENT_FACES[req] || [req];
  const available = availableDice(state);
  for (const face of faces) {
    const die = available.find((candidate) => candidate.face === face);
    if (die) return die;
  }
  return null;
}
export function spendDie(state, die, why) {
  if (!die) return;
  die.status = DIE_STATE.USED;
  log(state, "Used the " + die.face + " die" + (why ? " — " + why : "") + ".");
}
// rule 36 / 23 selection: at random from the dice that do not show a preferred result; from all dice if every die does
export function nonPreferredFirst(state, dice, count) {
  const preferredResults = preferredFaces(state);
  let candidates = dice.filter((die) => !preferredResults.includes(die.face));
  if (!candidates.length) candidates = dice.slice();
  const out = [];
  while (out.length < count && candidates.length) {
    const i = randomBelow(candidates.length);
    out.push(candidates.splice(i, 1)[0]);
  }
  return out;
}
// Elven Ring (rule 36): change one non-preferred available die to the required result.
export function ringChange(state, req) {
  const available = availableDice(state).filter(
    (die) => die.kind === DIE_KIND.ACTION,
  );
  if (!available.length) return null;
  const die = nonPreferredFirst(state, available, 1)[0];
  const from = die.face;
  let face = req;
  if (req === DIE_REQUIREMENT.CHAR_OR_MUSTER) face = FACE.CHARACTER;
  else if (isFactionRequirement(req)) face = FACE.WILD;
  die.face = face;
  state.board.rings = Math.max(0, state.board.rings - 1);
  state.ringUsedThisTurn = true;
  log(
    state,
    "Used an Elven Ring: changed a " +
      from +
      " die to " +
      die.face +
      " (rule 36). Rings left: " +
      state.board.rings +
      ".",
  );
  return die;
}
