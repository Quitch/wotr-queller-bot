// The grey boxes: enter another page with the die it needs, return from it, set a die aside, switch strategy, look for a ring use.
import * as engine from "../engine/index.js";
import { DIE_KIND, DIE_REQUIREMENT, TRAIL } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { cur, endWalk, follow, goto, setPrompt, trail } from "./core.js";
import { findStart, normalizeText } from "./graph.js";
import {
  DIE_REQUIREMENT_NAME,
  dieWithArticle,
  jumpSpec,
} from "./jumps-table.js";
import { PENDING, PROMPT, WALK_RESULT, phaseResult } from "./prompt.js";
import { startWalk } from "./run.js";

export function handleJump(state, node) {
  const walk = state.walk,
    spec = jumpSpec(NODE.text(node)),
    label = normalizeText(NODE.text(node));
  if (!spec) {
    trail(state, { kind: TRAIL.SKIP, text: label, why: "unknown box" });
    exitJump(state);
    return;
  }
  if (NODE.extra(node).wome && !state.settings.wome) {
    trail(state, { kind: TRAIL.SKIP, text: label, why: "WoME not in play" });
    exitJump(state);
    return;
  }
  const handler = JUMP_KIND[spec.kind];
  if (handler) handler(state, walk, spec, label);
  else jumpWithDie(state, spec, label);
}
// "Switch to military/Corruption": change strategy and either end the walk or restart it on the other strategy's page (rule 40).
function switchStrategy(state, walk, spec, label) {
  state.strategy = spec.strategy;
  engine.log(state, "Strategy changed to " + spec.strategy + " (rule 40).");
  trail(state, { kind: TRAIL.JUMP, text: label });
  if (spec.endWalk) {
    endWalk(state, phaseResult(spec.endWalk), spec.text);
    return;
  }
  goto(state, spec.page, findStart(spec.page, spec.start));
  walk.trail[0] = {
    kind: TRAIL.START,
    text: spec.start,
    page: spec.page,
    node: walk.node,
  };
  follow(state, null);
}
// "Save muster die for minion": set the die aside and return to the calling page.
function reserveDie(state, walk, spec, label) {
  // A die already set aside and brought back by "Use Muster die set aside for minion" must be used now (Rulings), not set aside again.
  if (walk.fromReserve) {
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "this die was already set aside — it must be used now",
    });
    exitJump(state);
    return;
  }
  state.minionReserved = true;
  if (walk.dieIndex != null && state.settings.dice) {
    state.dice.pool[walk.dieIndex].status = engine.DIE_STATE.RESERVED;
  }
  delete walk.dieAns[DIE_REQUIREMENT.MUSTER];
  delete walk.dieAns[DIE_REQUIREMENT.CHAR_OR_MUSTER]; // the die the player said Queller had is no longer available
  engine.log(state, "Muster die set aside for a minion (Rulings).");
  trail(state, {
    kind: TRAIL.NOTE,
    text: "Muster die set aside for a minion",
  });
  walk.dieIndex = null;
  walk.die = null;
  doReturn(state);
}
// "Phase 5 (use a ring)": restart the walk looking for a ring use (rule 37) when a ring and a die to change are available.
function ringAnyJump(state, walk, spec, label) {
  const canUseRing =
    walk.mode !== "ringAny" &&
    engine.ringAvailable(state) &&
    (!state.settings.dice ||
      engine.availableDice(state).some((die) => die.kind === DIE_KIND.ACTION));
  if (canUseRing) {
    trail(state, { kind: TRAIL.JUMP, text: label });
    const entry = walk.entry;
    walk.done = true;
    state.walk = null;
    startWalk(state, entry.page, entry.start, { mode: "ringAny" });
    return;
  }
  let why = "no die to change";
  if (state.ringUsedThisTurn) why = "a ring was already used this turn";
  else if (engine.ringsKnown(state) && !state.board.rings)
    why = "no Elven Ring";
  trail(state, { kind: TRAIL.SKIP, text: label, why });
  exitJump(state);
}
// Grey boxes that do not name a page, by the `kind` of their JUMPS entry; a page name goes through jumpWithDie instead.
const JUMP_KIND = {
  return: (state, walk, spec, label) => {
    trail(state, { kind: TRAIL.RETURN, text: label });
    doReturn(state);
  },
  endPhase4: (state) =>
    endWalk(state, phaseResult("Phase 5"), "Phase 5 begins — you act first."),
  battleNext: (state) =>
    endWalk(
      state,
      WALK_RESULT.BATTLE_NEXT,
      "Another combat round: walk again from “Battle (next round)”.",
    ),
  switch: switchStrategy,
  reserve: reserveDie,
  ringAny: ringAnyJump,
};
// Grey box naming a page: enter it with the die it needs (or the die already held), or skip it.
function jumpWithDie(state, spec, label) {
  const walk = state.walk;
  if (engine.dieSatisfies(walk.die, spec.die)) {
    enterPage(state, spec, label);
    return;
  }
  const dieResult = ensureDie(state, spec.die, label);
  if (dieResult === PENDING) return;
  if (dieResult) enterPage(state, spec, label);
  else exitJump(state);
}
// Make sure Queller has a die of type `req` for the step `label`. Returns true (use it), false (skipped, trail written), or PENDING (prompt open).
export function ensureDie(state, req, label) {
  const walk = state.walk;
  if (walk.pendingDie === label) {
    walk.pendingDie = null;
    const dieResult = walk.dieAns[req];
    walk.ringArmed = false;
    if (!dieResult)
      trail(state, {
        kind: TRAIL.SKIP,
        text: label,
        why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
      });
    return !!dieResult;
  }
  if (state.settings.dice) return ensureDieFromPool(state, walk, req, label);
  return askForDie(state, walk, req, label);
}
// With dice rolled by the app: take a matching die from the pool, changing one with an Elven Ring when that is armed.
function ensureDieFromPool(state, walk, req, label) {
  let die = engine.findDie(state, req);
  if (!die && ringPossible(state)) {
    die = engine.ringChange(state, req);
    if (die)
      trail(state, {
        kind: TRAIL.RING,
        text: "Elven Ring: die changed to " + die.face,
      });
  }
  walk.ringArmed = false;
  if (!die) {
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "no " + DIE_REQUIREMENT_NAME[req] + " die available",
    });
    return false;
  }
  walk.dieIndex = state.dice.pool.indexOf(die);
  return true;
}
// Without dice: ask the player whether Queller has the die (once per type per walk), then offer an Elven Ring before giving up.
function askForDie(state, walk, req, label) {
  if (walk.dieAns[req] === undefined) {
    setPrompt(state, {
      type: PROMPT.DIE_CHECK,
      req,
      label,
      text:
        "Does Queller have " +
        dieWithArticle(req) +
        " die available" +
        (req === DIE_REQUIREMENT.ARMY || req === DIE_REQUIREMENT.MUSTER
          ? " (an Army/Muster die counts)"
          : "") +
        "?",
    });
    return PENDING;
  }
  if (walk.dieAns[req]) {
    walk.ringArmed = false;
    return true;
  }
  if (ringPossible(state) && !walk.ringAsked) {
    walk.ringAsked = true;
    setPrompt(state, {
      type: PROMPT.RING,
      req,
      label,
      text:
        (engine.ringsKnown(state)
          ? ""
          : "If the Shadow holds an Elven Ring: ") +
        "Use an Elven Ring (rule 36): change one Queller die that does not show a *preferred* result into " +
        dieWithArticle(req) +
        " result. Choose the die at random.",
    });
    return PENDING;
  }
  walk.ringArmed = false;
  trail(state, {
    kind: TRAIL.SKIP,
    text: label,
    why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
  });
  return false;
}
function ringPossible(state) {
  const walk = state.walk;
  return (
    engine.ringAvailable(state) && (walk.ringArmed || walk.mode === "ringAny")
  );
}
function enterPage(state, spec, label) {
  const walk = state.walk;
  walk.stack.push({
    page: walk.page,
    node: walk.node,
    die: walk.die,
    dieIndex: walk.dieIndex,
    dieUsed: walk.dieUsed,
  });
  if (!engine.dieSatisfies(walk.die, spec.die)) walk.die = spec.die;
  trail(state, {
    kind: TRAIL.JUMP,
    text: label,
    die: DIE_REQUIREMENT_NAME[walk.die],
  });
  walk.ringAsked = false;
  walk.cands = null;
  walk.chosen = null;
  walk.steps = null;
  goto(state, spec.page, findStart(spec.page, spec.start));
  follow(state, null);
}
function exitJump(state) {
  // follow the arrow out of the current grey box; if none, return further
  if (!follow(state, null)) doReturn(state);
}
export function doReturn(state) {
  const walk = state.walk;
  if (!walk.stack.length) {
    // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (Rulings: it cannot be used for anything else).
    if (
      walk.fromReserve &&
      state.settings.dice &&
      walk.reservedDieIndex != null &&
      state.dice.pool[walk.reservedDieIndex].status === engine.DIE_STATE.AVAIL
    ) {
      engine.spendDie(
        state,
        state.dice.pool[walk.reservedDieIndex],
        "set aside for a minion, no action possible",
      );
      endWalk(
        state,
        WALK_RESULT.ACTION,
        "Queller sets aside the Muster die it had kept for a minion — no action was possible with it.",
      );
      return;
    }
    endWalk(
      state,
      WALK_RESULT.NO_ACTION,
      walk.page === "BA"
        ? "Nothing further from the Battle page this round."
        : "Queller has no action from this walk.",
    );
    return;
  }
  const frame = walk.stack.pop();
  goto(state, frame.page, frame.node);
  walk.die = frame.die;
  walk.dieIndex = frame.dieIndex;
  walk.dieUsed = frame.dieUsed;
  walk.cands = null;
  walk.chosen = null;
  trail(state, {
    kind: TRAIL.BACK,
    text: normalizeText(NODE.text(cur(state))),
  });
  exitJump(state);
}
