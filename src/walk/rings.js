// Elven Rings (rules 43-46): the die each bold box lets a ring create, and a ring use that stays pending until the die
// it made is spent. A die that is given up unspent turns back, the ring returns, and the next step may use it instead
// (rule 46: the die of the first step that is possible).
import * as engine from "../engine/index.js";
import { DIE_REQUIREMENT, TRAIL } from "../engine/index.js";
import { NODE_KIND } from "../flow/index.js";
import { setPrompt, trail } from "./core.js";
import { dieWithArticle } from "./jumps-table.js";
import { PENDING, PROMPT } from "./prompt.js";

// any die: a walk saved before rule 46 was applied armed the ring this way
const ANY_DIE = "any";
const { ARMY, CHARACTER, CHAR_OR_MUSTER, EVENT, MUSTER } = DIE_REQUIREMENT;
const NAZGUL_OR_MINION =
  "Does the *adjacent* *mobile* Army contain a Nazgûl or a minion (rule 46: then an Elven Ring makes a Character die, otherwise an Army die)";
// Rule 46, by bold box: the dice a ring may create; for a die the rule limits, the box the walk must then answer Yes
// (needs) or the question to put before the ring is used (ask).
const RING_RESULTS = {
  // the die of the first step below the box that is possible
  "C5.threat": { dice: [CHARACTER, ARMY, MUSTER, CHAR_OR_MUSTER] },
  "M5.threat": { dice: [CHARACTER, ARMY, MUSTER, CHAR_OR_MUSTER] },
  "C5.charMordor": { dice: [CHARACTER, EVENT] },
  "M5.charMordor": { dice: [CHARACTER, EVENT] },
  // only if he can join or create a mobile Army
  "C5.wkNotMob": { dice: [CHARACTER], needs: { [CHARACTER]: "CH.wkJoin" } },
  "M5.wkNotMob": { dice: [CHARACTER], needs: { [CHARACTER]: "CH.wkJoin" } },
  // not when the Muster page would set the die aside (walk/jumps.js reserveDie)
  "C5.minion": { dice: [MUSTER] },
  "M5.minion": { dice: [MUSTER] },
  // Character if the adjacent mobile Army contains a Nazgûl or a minion, otherwise Army
  "C5.mordorWin": {
    dice: [CHARACTER, ARMY],
    ask: { [CHARACTER]: NAZGUL_OR_MINION },
  },
  "M5.mobAdjBlock": {
    dice: [CHARACTER, ARMY],
    ask: { [CHARACTER]: NAZGUL_OR_MINION },
  },
};
const PHASE_5_PAGES = ["C5", "M5"];
// A decision was recorded: a main decision on a Phase 5 page ends what the last bold box armed, and a Yes to a bold box
// arms the dice rule 46 gives it.
export function armRing(state, key, isMainDecision, answer, ringCondition) {
  const walk = state.walk;
  if (isMainDecision && PHASE_5_PAGES.includes(walk.page)) {
    walk.ringDice = null;
    walk.ringNeeds = null;
    walk.ringAsk = null;
  }
  if (!answer || !ringCondition || state.ringUsedThisTurn) return;
  const result = RING_RESULTS[key] || { dice: ANY_DIE };
  walk.ringDice = result.dice;
  walk.ringNeeds = result.needs || null;
  walk.ringAsk = result.ask || null;
}
// Whether a ring may create a die of type `req` here.
export function ringMayCreate(state, req) {
  const walk = state.walk;
  if (!engine.ringAvailable(state)) return false;
  if (walk.mode === "ringAny" || walk.ringDice === ANY_DIE) return true;
  return !!walk.ringDice?.includes(req);
}
// The question rule 46 puts before a ring makes a die of type `req` (null when there is none).
export const ringQuestion = (state, req) => state.walk.ringAsk?.[req] || null;
// With dice rolled by the app, ask that question as a board question: true or false, or PENDING while it is open.
export function ringAllowed(state, req) {
  const walk = state.walk,
    question = ringQuestion(state, req);
  if (!question) return true;
  const part = walk.page + "." + walk.node + ".ring46";
  if (part in walk.parts) return walk.parts[part];
  setPrompt(state, {
    type: PROMPT.YES_NO,
    text: question,
    part,
    node: walk.node,
    page: walk.page,
    kind: NODE_KIND.FOLLOW_UP,
    board: true,
  });
  return PENDING;
}
// A ring was used for a die of type `req`: ringsBefore is the ring count before it, and with dice on dieIndex and
// from are the pool die it changed and the face it showed.
export function ringUsed(state, req, ringsBefore, dieIndex, from) {
  const walk = state.walk;
  walk.ringPending = {
    reqs: [req],
    ringsBefore,
    dieIndex: dieIndex ?? null,
    from: from ?? null,
    needs: walk.ringNeeds?.[req] || null,
    spent: false,
  };
}
// The walk carries the die it holds into a page that uses it as another die (the Army page's "Muster 3"): with dice off,
// that die is still the ring's.
export function ringDieHeldAs(state, req) {
  const pending = state.walk?.ringPending;
  if (pending && !state.settings.dice && holdsRingDie(state, pending))
    pending.reqs.push(req);
}
// The walk spent the die it holds: if a ring made it, the ring use stands.
export function ringDieSpent(state) {
  const pending = state.walk?.ringPending;
  if (pending && holdsRingDie(state, pending)) pending.spent = true;
}
// The walk holds the ring's die only while it holds a die at all: a page it returned from leaves dieIndex behind.
function holdsRingDie(state, pending) {
  const walk = state.walk;
  if (!walk.die) return false;
  return state.settings.dice
    ? walk.dieIndex === pending.dieIndex
    : pending.reqs.includes(walk.die);
}
// With dice on, a die that is no longer available was used (marked used, or discarded): the ring stays used.
const ringDieGone = (state, pending) =>
  state.settings.dice &&
  state.dice.pool[pending.dieIndex]?.status !== engine.DIE_STATE.AVAIL;
// Undo a ring use: the die turns back, the ring returns, and the walk may use a ring again for the next step.
export function returnRing(state, why) {
  const walk = state.walk,
    pending = walk.ringPending;
  walk.ringPending = null;
  if (ringDieGone(state, pending)) return;
  walk.ringAsked = false;
  state.board.rings = pending.ringsBefore;
  state.ringUsedThisTurn = false;
  const req = pending.reqs[0];
  if (state.settings.dice) {
    const die = state.dice.pool[pending.dieIndex];
    die.face = pending.from;
    engine.log(
      state,
      "Elven Ring not used (" +
        why +
        "): the die is back to " +
        die.face +
        " (rule 43).",
    );
  } else {
    walk.dieAns[req] = false;
    engine.log(
      state,
      "Elven Ring not used (" +
        why +
        "): turn the die back to the result it showed (rule 43).",
    );
  }
  trail(state, {
    kind: TRAIL.RING,
    text: "Elven Ring not used for " + dieWithArticle(req) + " die: " + why,
  });
}
// Settle a pending ring use when the walk lets go of the die: a die spent keeps the ring used; a die given up unspent
// returns it. `letGo`: the walk is over or claims another die, so a die still held is given up too.
export function settleRing(state, letGo) {
  const pending = state.walk?.ringPending;
  if (!pending) return;
  if (pending.spent) {
    state.walk.ringPending = null;
    return;
  }
  if (!letGo && holdsRingDie(state, pending)) return;
  returnRing(state, "the step it was for was not possible");
}
// The box a limited ring use needs (rule 46) was answered: Yes lets the use stand, No undoes it. Returns true when the
// ring was undone, so the page gives up the step.
export function ringNeedAnswered(state, key, answer) {
  const pending = state.walk?.ringPending;
  if (!pending?.needs || pending.needs !== key) return false;
  pending.needs = null;
  if (answer) return false;
  returnRing(state, "rule 46 does not allow it here");
  return true;
}
