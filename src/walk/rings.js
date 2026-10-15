// Elven Rings (rules 43-46): the die each bold box lets a ring create, and a ring use that stays pending until the die
// it made is spent. A die that is given up unspent turns back, the ring returns, and the next step may use it instead
// (rule 46: the die of the first step that is possible).
import * as engine from "../engine/index.js";
import { DIE_REQUIREMENT, TRAIL } from "../engine/index.js";
import { trail } from "./core.js";
import { dieWithArticle } from "./jumps-table.js";

const ANY_DIE = "any";
const { ARMY, CHARACTER, EVENT, MUSTER } = DIE_REQUIREMENT;
// Rule 46, by bold box: the dice a ring may create (ANY_DIE: the die of whichever step below is possible), and for a
// die whose use the rule limits, the box the walk must then answer Yes or the ring is not used.
const RING_RESULTS = {
  "C5.threat": { dice: ANY_DIE },
  "M5.threat": { dice: ANY_DIE },
  "C5.charMordor": { dice: [CHARACTER, EVENT] },
  "M5.charMordor": { dice: [CHARACTER, EVENT] },
  // only if he can join or create a mobile Army
  "C5.wkNotMob": { dice: [CHARACTER], needs: { [CHARACTER]: "CH.wkJoin" } },
  "M5.wkNotMob": { dice: [CHARACTER], needs: { [CHARACTER]: "CH.wkJoin" } },
  // not when the Muster page would set the die aside (walk/jumps.js reserveDie)
  "C5.minion": { dice: [MUSTER] },
  "M5.minion": { dice: [MUSTER] },
  // Character only for an Army with a Nazgûl or a minion (the Character page's attack), otherwise Army
  "C5.mordorWin": {
    dice: [CHARACTER, ARMY],
    needs: { [CHARACTER]: "CH.aggr" },
  },
  "M5.mobAdjBlock": {
    dice: [CHARACTER, ARMY],
    needs: { [CHARACTER]: "CH.aggr" },
  },
};
const PHASE_5_PAGES = ["C5", "M5"];
// A decision was recorded: a main decision on a Phase 5 page ends what the last bold box armed, and a Yes to a bold box
// arms the dice rule 46 gives it.
export function armRing(state, key, isMainDecision, answer, ringCondition) {
  const walk = state.walk;
  if (isMainDecision && PHASE_5_PAGES.includes(walk.page)) walk.ringDice = null;
  if (!answer || !ringCondition || state.ringUsedThisTurn) return;
  walk.ringDice = (RING_RESULTS[key] || { dice: ANY_DIE }).dice;
  walk.ringNeeds = RING_RESULTS[key]?.needs || null;
}
// Whether a ring may create a die of type `req` here.
export function ringMayCreate(state, req) {
  const walk = state.walk;
  if (!engine.ringAvailable(state)) return false;
  if (walk.mode === "ringAny" || walk.ringDice === ANY_DIE) return true;
  return !!walk.ringDice?.includes(req);
}
// A ring was used for a die of type `req`: ringsBefore is the ring count before it, and with dice on dieIndex and
// from are the pool die it changed and the face it showed.
export function ringUsed(state, req, ringsBefore, dieIndex, from) {
  const walk = state.walk;
  walk.ringPending = {
    req,
    ringsBefore,
    dieIndex: dieIndex ?? null,
    from: from ?? null,
    needs: walk.ringNeeds?.[req] || null,
    spent: false,
  };
}
// The walk spent the die it holds: if a ring made it, the ring use stands.
export function ringDieSpent(state) {
  const pending = state.walk?.ringPending;
  if (pending && holdsRingDie(state, pending)) pending.spent = true;
}
function holdsRingDie(state, pending) {
  const walk = state.walk;
  return state.settings.dice
    ? walk.dieIndex === pending.dieIndex
    : walk.die === pending.req;
}
// Undo a ring use: the die turns back, the ring returns, and the walk may use a ring again for the next step.
export function returnRing(state, why) {
  const walk = state.walk,
    pending = walk.ringPending;
  walk.ringPending = null;
  walk.ringAsked = false;
  state.board.rings = pending.ringsBefore;
  state.ringUsedThisTurn = false;
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
    walk.dieAns[pending.req] = false;
    engine.log(
      state,
      "Elven Ring not used (" +
        why +
        "): turn the die back to the result it showed (rule 43).",
    );
  }
  trail(state, {
    kind: TRAIL.RING,
    text:
      "Elven Ring not used for " + dieWithArticle(pending.req) + " die: " + why,
  });
}
// Settle a pending ring use when the walk lets go of the die: a die spent keeps the ring used; a die given up unspent
// returns it. `ending`: the walk is over, so a die still held is given up too.
export function settleRing(state, ending) {
  const pending = state.walk?.ringPending;
  if (!pending) return;
  if (pending.spent) {
    state.walk.ringPending = null;
    return;
  }
  if (!ending && holdsRingDie(state, pending)) return;
  returnRing(state, "the step it was for was not possible");
}
// A die is about to be claimed for another step: the ring die held now is given up.
export function giveUpRingDie(state) {
  const pending = state.walk?.ringPending;
  if (pending && !pending.spent)
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
