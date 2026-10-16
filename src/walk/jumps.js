// The grey boxes: enter another page with the die it needs, return from it, set a die aside, switch strategy, look for a ring use.
import * as engine from "../engine/index.js";
import { DIE_REQUIREMENT, TRAIL } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import {
  askBoardQuestion,
  doReturn,
  endWalk,
  exitJump,
  follow,
  goto,
  setPrompt,
  trail,
} from "./core.js";
import { findStart, normalizeText } from "./graph.js";
import {
  DIE_REQUIREMENT_NAME,
  EXPOSED_ARMY_JUMPS,
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
  letGoOtherRingDie,
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
function setDieAside(state, walk) {
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
  if (walk.ringPending)
    returnRing(state, "the Muster page would set the die aside");
  else setDieAside(state, walk);
  walk.dieIndex = null;
  walk.die = null;
  doReturn(state);
}
// "Phase 5 (use an Elven Ring)": restart the walk looking for an Elven Ring use (rule 44) when a ring and a die to change are available.
function ringAnyJump(state, walk, spec, label) {
  settleRing(state, true);
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
  if ((spec.held && walk.die) || engine.dieSatisfies(walk.die, spec.die)) {
    enterPage(state, spec, label);
    return;
  }
  letGoOtherRingDie(state, spec.die);
  const before = {
    die: walk.die,
    dieIndex: walk.dieIndex,
    dieViaMessenger: walk.dieViaMessenger,
  };
  const byCharacter = exposedCharacterFallback(state, walk);
  if (byCharacter === PENDING) return;
  const page = byCharacter ? { ...spec, die: DIE_REQUIREMENT.CHARACTER } : spec;
  const dieResult = ensureDie(state, page.die, label);
  if (dieResult === PENDING) return;
  if (!dieResult) {
    exitJump(state);
    return;
  }
  // a ring may have changed the very die the walk held: the return must not bring it back as its old type
  const sameDie =
    before.dieIndex != null &&
    walk.dieIndex === before.dieIndex &&
    walk.ringPending?.dieIndex === before.dieIndex;
  enterPage(
    state,
    page,
    label,
    sameDie ? { die: null, dieIndex: null, dieViaMessenger: false } : before,
  );
}
// Rule 11: the move towards an exposed target uses an Army die, else an Army/Muster die, else a Character die with an
// Army that contains a Nazgûl or a minion. At the threat column's "Army" jump for that move, with no Army die (rolled,
// or with dice off answered No) and a Character die possibly there, ask about the Army that moves. Returns true to
// claim a Character die instead, false, or PENDING (a question is open). A Messenger Muster die is an Army die here.
const MINIONS = ["witchKing", "mouth", "saruman"];
function exposedCharacterFallback(state, walk) {
  if (!EXPOSED_ARMY_JUMPS.has(walk.page + "." + walk.node)) return false;
  if (state.settings.dice) {
    const armyDie =
      engine.findDie(state, DIE_REQUIREMENT.ARMY) ||
      (messengerAvailable(state) &&
        engine.findDie(state, DIE_REQUIREMENT.MUSTER));
    if (armyDie || !engine.findDie(state, DIE_REQUIREMENT.CHARACTER))
      return false;
  } else if (
    walk.dieAns[DIE_REQUIREMENT.ARMY] !== false ||
    walk.dieAns[DIE_REQUIREMENT.CHARACTER] === false
  )
    return false;
  if (
    state.settings.tracker &&
    !state.board.nazgul &&
    !MINIONS.some((minion) => engine.minionInPlay(state, minion))
  )
    return false;
  return askBoardQuestion(
    state,
    walk.page + "." + walk.node + ".exposedCharacterDie",
    "Queller has no Army die. Does the Army that moves towards the *exposed* *target* contain a Nazgûl or a minion (then a Character die moves it, rule 11)",
  );
}
// Make sure Queller has a die of type `req` for the step `label`. Returns true (use it), false (skipped, trail written), or PENDING (prompt open).
export function ensureDie(state, req, label) {
  const walk = state.walk;
  if (walk.pendingDie === label) {
    // the die question was answered (dice off): use the die, offer a ring, or skip
    walk.pendingDie = null;
    return askForDie(state, walk, req, label);
  }
  if (state.settings.dice) return ensureDieFromPool(state, walk, req, label);
  return askForDie(state, walk, req, label);
}
// Messenger of the Dark Tower (rule 30): with the Mouth of Sauron in play, once per turn, a Muster die may act as an
// Army die when Queller has no Army or Army/Muster die.
const messengerAvailable = (state) =>
  engine.minionInPlay(state, "mouth") && !state.messengerUsedThisTurn;
// With dice rolled by the app: take a matching die from the pool, changing one with an Elven Ring when that is armed.
function ensureDieFromPool(state, walk, req, label) {
  let die = engine.findDie(state, req);
  let viaMessenger = false;
  if (!die && req === DIE_REQUIREMENT.ARMY && messengerAvailable(state)) {
    die = engine.findDie(state, DIE_REQUIREMENT.MUSTER);
    if (die) {
      viaMessenger = true;
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
  walk.dieViaMessenger = viaMessenger;
  return true;
}
// The rule 46 question a limited ring offer depends on, as the offer states it.
function ringLimitText(limit) {
  if (!limit) return "";
  const answer = limit.answer ? "Yes" : "No";
  return (
    " Only if the answer to this is " + answer + ": " + limit.question + "?"
  );
}
// What counts as the die, added to the dice-off question.
const DIE_QUESTION_NOTE = {
  [DIE_REQUIREMENT.ARMY]: " (an Army/Muster die counts)",
  [DIE_REQUIREMENT.MUSTER]: " (an Army/Muster die counts)",
  [DIE_REQUIREMENT.FACTION_RECRUIT]:
    " (a Wild result on the Faction die counts, rule 31)",
  [DIE_REQUIREMENT.FACTION_PLAY]:
    " (a Wild result on the Faction die counts, rule 31)",
  [DIE_REQUIREMENT.FACTION_DRAW]:
    " (a Wild result on the Faction die counts, rule 31)",
};
// With dice off, Messenger of the Dark Tower may apply unless it was used this turn or the tracker shows no Mouth of
// Sauron in play.
const messengerPossible = (state) =>
  !state.messengerUsedThisTurn &&
  (!state.settings.tracker || engine.minionInPlay(state, "mouth"));
// With dice off, after a No to the Army die: may a Muster die act as one (rule 30)?
function askMessenger(state, req, label) {
  setPrompt(state, {
    type: PROMPT.DIE_CHECK,
    req,
    label,
    messenger: true,
    text: "Does Queller have a Muster die to use as an Army die with Messenger of the Dark Tower (the Mouth of Sauron in play, once per turn, rule 30)?",
  });
  return PENDING;
}
// With dice off and no die of type `req`: offer an Elven Ring, once per walk.
function offerRing(state, walk, req, label) {
  walk.ringAsked = true;
  setPrompt(state, {
    type: PROMPT.RING,
    req,
    label,
    text:
      (engine.ringsKnown(state) ? "" : "If the Shadow holds an Elven Ring: ") +
      "Use an Elven Ring (rule 43): change one Queller die that does not show a *preferred* result into " +
      dieWithArticle(req) +
      " result. Choose the die at random. If the step then turns out not to be possible, the app tells you to turn the die back (rule 43)." +
      ringLimitText(ringQuestion(state, req)),
  });
  return PENDING;
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
  if (walk.dieAns[req]) {
    if (req === DIE_REQUIREMENT.ARMY && walk.messengerAns)
      walk.dieViaMessenger = true;
    return true;
  }
  if (
    req === DIE_REQUIREMENT.ARMY &&
    walk.messengerAns === null &&
    messengerPossible(state)
  )
    return askMessenger(state, req, label);
  if (ringMayCreate(state, req) && !walk.ringAsked)
    return offerRing(state, walk, req, label);
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
    dieViaMessenger: before ? before.dieViaMessenger : walk.dieViaMessenger,
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
  if (spec.page === "AR") {
    walk.armyStart = spec.start;
    walk.armyMoves = 0;
  }
  goto(state, spec.page, findStart(spec.page, spec.start));
  follow(state, null);
}
