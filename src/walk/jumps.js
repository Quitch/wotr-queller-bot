// The grey boxes: enter another page with the die it needs, return from it, set a die aside, switch strategy, look for a ring use.
import * as engine from "../engine/index.js";
import { DIE_REQUIREMENT, TRAIL } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { cur, endWalk, follow, goto, setPrompt, trail } from "./core.js";
import { findStart, normalizeText } from "./graph.js";
import {
  DIE_REQUIREMENT_NAME,
  dieWithArticle,
  jumpSpec,
} from "./jumps-table.js";
import {
  PENDING,
  PROMPT,
  WALK_RESULT,
  phaseResult,
  strategyName,
} from "./prompt.js";
import {
  returnRing,
  ringAllowed,
  ringDieHeldAs,
  ringMayCreate,
  ringQuestion,
  ringUsed,
  settleRing,
} from "./rings.js";
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
// "Switch to Military/Corruption": change strategy and either end the walk or restart it on the other strategy's page (rule 48).
function switchStrategy(state, walk, spec, label) {
  state.strategy = spec.strategy;
  engine.log(
    state,
    "Strategy changed to " + strategyName(spec.strategy) + " (rule 48).",
  );
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
  // A die already set aside and brought back by "Use Muster die set aside for minion" must be used now (rule 34), not set aside again.
  if (walk.fromReserve) {
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "this die was already set aside — it must be used now",
    });
    exitJump(state);
    return;
  }
  // rule 46: an Elven Ring does not make a Muster die to be set aside, so without it there is no die to set aside
  if (walk.ringPending) {
    returnRing(state, "the Muster page would set the die aside");
    walk.die = null;
    walk.dieIndex = null;
    doReturn(state);
    return;
  }
  state.minionReserved = true;
  if (walk.dieIndex != null && state.settings.dice) {
    state.dice.pool[walk.dieIndex].status = engine.DIE_STATE.RESERVED;
  }
  delete walk.dieAns[DIE_REQUIREMENT.MUSTER];
  delete walk.dieAns[DIE_REQUIREMENT.CHAR_OR_MUSTER]; // the die the player said Queller had is no longer available
  engine.log(state, "Muster die set aside for a minion (rule 34).");
  trail(state, {
    kind: TRAIL.NOTE,
    text: "Muster die set aside for a minion",
  });
  walk.dieIndex = null;
  walk.die = null;
  doReturn(state);
}
// "Phase 5 (use an Elven Ring)": restart the walk looking for an Elven Ring use (rule 44) when a ring and a die to change are available.
function ringAnyJump(state, walk, spec, label) {
  settleRing(state);
  const canUseRing =
    walk.mode !== "ringAny" &&
    engine.ringAvailable(state) &&
    (!state.settings.dice || engine.availableActionDice(state).length > 0);
  if (canUseRing) {
    trail(state, { kind: TRAIL.JUMP, text: label });
    const entry = walk.entry;
    startWalk(state, entry.page, entry.start, { mode: "ringAny" });
    return;
  }
  let why = "no die to change";
  if (state.ringUsedThisTurn) why = "an Elven Ring was already used this turn";
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
  sameWalk: (state, walk, spec, label) => {
    trail(state, { kind: TRAIL.JUMP, text: label });
    goto(state, spec.page, findStart(spec.page, spec.start));
    follow(state, null);
  },
  switch: switchStrategy,
  reserve: reserveDie,
  ringAny: ringAnyJump,
};
// Grey box naming a page: enter it with the die it needs (or the die already held), or skip it.
function jumpWithDie(state, spec, label) {
  const walk = state.walk;
  if (spec.held || engine.dieSatisfies(walk.die, spec.die)) {
    enterPage(state, spec, label);
    return;
  }
  const before = { die: walk.die, dieIndex: walk.dieIndex };
  const dieResult = ensureDie(state, spec.die, label);
  if (dieResult === PENDING) return;
  if (dieResult) enterPage(state, spec, label, before);
  else exitJump(state);
}
// Make sure Queller has a die of type `req` for the step `label`. Returns true (use it), false (skipped, trail written), or PENDING (prompt open).
export function ensureDie(state, req, label) {
  const walk = state.walk;
  if (walk.pendingDie === label) {
    walk.pendingDie = null;
    if (walk.dieAns[req]) return true;
    // no such die: an Elven Ring may still make one (asked once per walk)
    if (!state.settings.dice && ringMayCreate(state, req) && !walk.ringAsked)
      return askForDie(state, walk, req, label);
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
    });
    return false;
  }
  // claiming a die for another step gives up a die a ring made for the last one
  if (walk.ringPending && !walk.ringPending.reqs.includes(req))
    settleRing(state, true);
  if (state.settings.dice) return ensureDieFromPool(state, walk, req, label);
  return askForDie(state, walk, req, label);
}
// What else counts as the die asked about, without dice rolled by the app.
const DIE_QUESTION_NOTE = {
  [DIE_REQUIREMENT.ARMY]:
    " (an Army/Muster die counts; so does a Muster die once per turn with Messenger of the Dark Tower when the Mouth of Sauron is in play, rule 30)",
  [DIE_REQUIREMENT.MUSTER]: " (an Army/Muster die counts)",
};
// Messenger of the Dark Tower (rule 30): with the Mouth of Sauron in play, once per turn, a Muster die may act as an
// Army die when Queller has no Army or Army/Muster die.
const messengerAvailable = (state) =>
  engine.minionInPlay(state, "mouth") && !state.messengerUsedThisTurn;
// With dice rolled by the app: take a matching die from the pool, changing one with an Elven Ring when that is armed.
function ensureDieFromPool(state, walk, req, label) {
  let die = engine.findDie(state, req);
  if (!die && req === DIE_REQUIREMENT.ARMY && messengerAvailable(state)) {
    die = engine.findDie(state, DIE_REQUIREMENT.MUSTER);
    if (die) {
      walk.messengerDieIndex = state.dice.pool.indexOf(die);
      trail(state, {
        kind: TRAIL.NOTE,
        text: "Messenger of the Dark Tower: the Muster die acts as an Army die (rule 30)",
      });
    }
  }
  const allowed = !die && ringMayCreate(state, req) && ringAllowed(state, req);
  if (allowed === PENDING) return PENDING;
  if (allowed) {
    const ringsBefore = state.board.rings;
    const changed = engine.ringChange(state, req);
    if (changed) {
      die = changed.die;
      ringUsed(
        state,
        req,
        ringsBefore,
        state.dice.pool.indexOf(die),
        changed.from,
      );
      trail(state, {
        kind: TRAIL.RING,
        text: "Elven Ring: die changed to " + die.face,
      });
    }
  }
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
        (DIE_QUESTION_NOTE[req] || "") +
        "?",
    });
    return PENDING;
  }
  if (walk.dieAns[req]) return true;
  if (ringMayCreate(state, req) && !walk.ringAsked) {
    walk.ringAsked = true;
    setPrompt(state, {
      type: PROMPT.RING,
      req,
      label,
      text:
        (engine.ringsKnown(state)
          ? ""
          : "If the Shadow holds an Elven Ring: ") +
        "Use an Elven Ring (rule 43): change one Queller die that does not show a *preferred* result into " +
        dieWithArticle(req) +
        " result. Choose the die at random. If the step then turns out not to be possible, the app tells you to turn the die back (rule 43)." +
        (ringQuestion(state, req)
          ? " Only if the answer to this is " +
            (ringQuestion(state, req).answer ? "Yes" : "No") +
            ": " +
            ringQuestion(state, req).question +
            "?"
          : ""),
    });
    return PENDING;
  }
  trail(state, {
    kind: TRAIL.SKIP,
    text: label,
    why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
  });
  return false;
}
// before: the die the walk held before ensureDie claimed one for this page, which the return gives back.
function enterPage(state, spec, label, before) {
  const walk = state.walk;
  walk.stack.push({
    page: walk.page,
    node: walk.node,
    die: before ? before.die : walk.die,
    dieIndex: before ? before.dieIndex : walk.dieIndex,
    dieUsed: walk.dieUsed,
  });
  if (spec.held) ringDieHeldAs(state, spec.die);
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
    // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (rule 34: it cannot be used for anything else).
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
  settleRing(state);
  walk.cands = null;
  walk.chosen = null;
  trail(state, {
    kind: TRAIL.BACK,
    text: normalizeText(NODE.text(cur(state))),
  });
  exitJump(state);
}
