// The red boxes: what Queller does, with the die the box names; the End box spends the die.
import * as engine from "../engine/index.js";
import { DECK, DIE_REQUIREMENT, STRATEGY, TRAIL } from "../engine/index.js";
import { NODE, NODE_KIND } from "../flow/index.js";
import { endWalk, follow, goto, setPrompt, trail } from "./core.js";
import { findStart, normalizeText } from "./graph.js";
import { DIE_REQUIREMENT_NAME } from "./jumps-table.js";
import { doReturn, ensureDie } from "./jumps.js";
import { SHADOW_NATION_KEY } from "./nations.js";
import { FALL_THROUGH, PENDING, PROMPT, WALK_RESULT } from "./prompt.js";

// Draw steps and actions on the Event/Faction pages: the deck depends on the box; with cards off the player draws.
// The deck a draw node draws from: Character or Faction Event where the node says so, otherwise the strategy's preferred deck.
function drawDeck(state, key) {
  if (key === "EV.drawChar") return DECK.CHARACTER;
  if (key === "EV.drawFac" || key === "FA.drawT") return DECK.FACTION;
  return state.strategy === STRATEGY.CORRUPTION
    ? DECK.CHARACTER
    : DECK.STRATEGY;
}
export function drawStep(state, node) {
  const walk = state.walk,
    key = walk.page + "." + walk.node,
    label = normalizeText(NODE.text(node)),
    isStep = NODE.kind(node) === NODE_KIND.STEP;
  if (!state.settings.cards)
    return setPrompt(state, {
      type: isStep ? PROMPT.STEP : PROMPT.ACTION,
      text: label,
      node: walk.node,
    });
  const deckKey = drawDeck(state, key);
  const id = engine.drawCard(state, deckKey);
  trail(state, {
    kind: TRAIL.NOTE,
    text:
      "Drew a " +
      engine.deckName(deckKey) +
      " card" +
      (id ? "" : " — deck empty"),
  });
  if (isStep) {
    follow(state, null);
    return;
  }
  const handCount = engine.handCounts(state);
  setPrompt(state, {
    type: PROMPT.ACTION,
    text:
      label +
      " — done: Queller now holds " +
      handCount.total +
      " Event card" +
      (state.settings.wome
        ? "s and " + handCount.faction + " Faction Event card"
        : "") +
      "s.",
    node: walk.node,
    auto: true,
  });
}
// The die an action box names: hold it (or the die already held for it) before acting. Returns true to go on, false when
// the box was skipped for want of the die, or PENDING while a die question is open.
function claimActionDie(state, walk, node, label) {
  const die = NODE.extra(node).die;
  if (!die || (walk.die === die && walk.dieIndex != null)) return true;
  const dieResult = ensureDie(state, die, label);
  if (dieResult === PENDING) return PENDING;
  if (!dieResult) {
    exitAction(state);
    return false;
  }
  walk.die = die;
  return true;
}
const actionFacts = (state, label) => ({
  walk: state.walk,
  label,
  cardsOn: state.settings.cards,
  diceOn: state.settings.dice,
  trackerOn: state.settings.tracker,
});
// Record a box the walk skips over and follow its arrow out.
function skipAction(state, label, why) {
  trail(state, { kind: TRAIL.SKIP, text: label, why });
  exitAction(state);
}
function promptAction(state, node, text, extra) {
  setPrompt(state, {
    type: PROMPT.ACTION,
    text,
    node: state.walk.node,
    ...extra,
  });
}
// "Start of game": adopt the strategy the roll (or the player) chose.
const adoptStrategy = (strategy) =>
  function adopt(state) {
    state.strategy = strategy;
    const message = "Queller uses the " + strategy + " strategy.";
    engine.log(state, message);
    endWalk(state, WALK_RESULT.STRATEGY, message);
  };
// "Discard unplayable die" (rule 32): set aside one available die at random.
function discardUnusableDie(state, node, { diceOn, label }) {
  if (!diceOn)
    return promptAction(
      state,
      node,
      "Discard unplayable die: set aside one Queller die that could not be used, chosen at random (rule 32).",
    );
  const available = engine.availableDice(state);
  if (!available.length)
    return skipAction(state, label, "no die left to discard");
  const die = engine.pick(available);
  die.status = engine.DIE_STATE.USED;
  engine.log(
    state,
    "Discarded an unplayable " + die.face + " die at random (rule 32).",
  );
  endWalk(
    state,
    WALK_RESULT.ACTION,
    "Queller sets aside a " + die.face + " die it could not use (rule 32).",
  );
}
// Re-enter Muster 2 holding the Muster die that was set aside for a minion (Rulings: it must be used now).
function enterMuster2WithReservedDie(state, walk, reservedIndex) {
  walk.fromReserve = true;
  walk.reservedDieIndex = reservedIndex;
  trail(state, {
    kind: TRAIL.JUMP,
    text: "Muster 2 (die set aside for the minion)",
  });
  walk.stack.push({
    page: walk.page,
    node: walk.node,
    die: null,
    dieIndex: null,
    dieUsed: false,
  });
  walk.die = DIE_REQUIREMENT.MUSTER;
  walk.dieIndex = reservedIndex;
  goto(state, "MU", findStart("MU", "Muster 2"));
  follow(state, null);
}
// "Use Muster die set aside for minion": bring the reserved die back and walk Muster 2 with it.
function useReservedMinionDie(state, node, { walk, diceOn, label }) {
  const reserved = diceOn
    ? state.dice.pool.find((die) => die.status === engine.DIE_STATE.RESERVED)
    : null;
  if (diceOn ? !reserved : !state.minionReserved) {
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "no Muster die set aside",
    });
    endWalk(
      state,
      WALK_RESULT.NO_ACTION,
      "Queller has no action — it has no die it can use.",
    );
    return;
  }
  let reservedIndex = null;
  if (diceOn) {
    reserved.status = engine.DIE_STATE.AVAIL;
    reservedIndex = state.dice.pool.indexOf(reserved);
    state.minionReserved = state.dice.pool.some(
      (die) => die.status === engine.DIE_STATE.RESERVED,
    );
  } else state.minionReserved = false;
  enterMuster2WithReservedDie(state, walk, reservedIndex);
}
function promptPass(state, node) {
  promptAction(state, node, "Pass", {
    pass: true,
    help: "Only if the game rules permit a pass (Rulings). If Queller cannot pass, follow the arrow out.",
  });
}
// "Discard": the priority list already discarded with cards on; the die (if any) was spent on the draw.
function finishDiscardToLimit(state, node, { walk, cardsOn }) {
  if (cardsOn && walk.discards) {
    if (walk.die) spendCurrentDie(state, "drew a card");
    endWalk(state, WALK_RESULT.ACTION, "Discarded down to the hand limit.");
    return;
  }
  promptAction(state, node, "Discard the card chosen by the priority list.");
}
// The candidates a decision left behind, narrowed to one card by initiative when no priority list has chosen yet.
function chooseByInitiative(state, walk) {
  if (walk.chosen || !walk.cands?.length) return;
  const picked = engine.applyPriority(state, walk.cands, [
    "Ascending order of initiative",
  ]);
  walk.chosen = picked.chosen;
  walk.steps = picked.steps;
}
export function promptPlayCard(state, node, card, text, extra) {
  setPrompt(state, {
    type: PROMPT.PLAY_CARD,
    card,
    text,
    node: state.walk.node,
    ...extra,
  });
}
// "Play card": with cards on, the chosen card is shown; otherwise the player plays from Queller's hand.
function playChosenCard(state, node, { walk, cardsOn, label }) {
  if (cardsOn) chooseByInitiative(state, walk);
  if (cardsOn && walk.chosen)
    return promptPlayCard(state, node, walk.chosen, label);
  promptAction(state, node, label);
}
function musterWithCard(state, node, { walk, cardsOn }) {
  if (cardsOn && walk.chosen)
    return promptPlayCard(state, node, walk.chosen, "Muster with the card");
  return FALL_THROUGH;
}
// "Move nation down the Political Track": the nation the priority list chose, with the tracker's before/after.
function politicalTrackPreview(state, nationKey) {
  const now = state.board.nations[nationKey] ?? 0,
    next = Math.max(0, now - 1);
  return (
    " (" +
    engine.politicalTrackLabel(now) +
    " → " +
    engine.politicalTrackLabel(next) +
    ")"
  );
}
function advancePoliticalTrack(state, node, { walk, trackerOn, label }) {
  if (!walk.nationChoice || walk.nationChoice === "Faction")
    return skipAction(state, label, "no nation to advance");
  const nationKey = SHADOW_NATION_KEY[walk.nationChoice];
  if (!trackerOn)
    return promptAction(
      state,
      node,
      "Move " + walk.nationChoice + " down one on the Political Track.",
    );
  promptAction(
    state,
    node,
    "Move " +
      walk.nationChoice +
      " down one on the Political Track" +
      politicalTrackPreview(state, nationKey) +
      ".",
    { nation: nationKey },
  );
}
// The tracker field of each minion the Muster page can muster.
const MINION_KEY = {
  Saruman: "saruman",
  "Witch King": "witchKing",
  "Mouth of Sauron": "mouth",
};
function musterMinion(state, node, { walk, label }) {
  if (!walk.minionPick)
    return skipAction(state, label, "no minion can be mustered");
  promptAction(state, node, "Muster " + walk.minionPick + ".", {
    minion: MINION_KEY[walk.minionPick],
  });
}
function bringFactionIn(state, node, { walk, cardsOn, trackerOn, label }) {
  if (walk.factionChoice)
    return promptAction(
      state,
      node,
      "Bring the " + walk.factionChoice + " into play.",
      { faction: walk.factionChoice.toLowerCase() },
    );
  if (cardsOn || trackerOn)
    return skipAction(state, label, "no faction to bring in");
  return FALL_THROUGH;
}
// The action boxes with their own handling, keyed by page and node id. A handler is (state, node, facts); it returns
// FALL_THROUGH to leave the box to the generic handling.
const ACTION_HANDLERS = {
  "C14.sogCorr": adoptStrategy(STRATEGY.CORRUPTION),
  "M14.sogCorr": adoptStrategy(STRATEGY.CORRUPTION),
  "C14.sogMil": adoptStrategy(STRATEGY.MILITARY),
  "M14.sogMil": adoptStrategy(STRATEGY.MILITARY),
  "C5.discardDie": discardUnusableDie,
  "M5.discardDie": discardUnusableDie,
  "C5.minionDie": useReservedMinionDie,
  "M5.minionDie": useReservedMinionDie,
  "C5.pass": promptPass,
  "M5.pass": promptPass,
  "EV.drawPref": drawStep,
  "EV.drawChar": drawStep,
  "EV.drawFac": drawStep,
  "EV.discard": finishDiscardToLimit,
  "FA.discard": finishDiscardToLimit,
  "EV.playA": playChosenCard,
  "EV.playB": playChosenCard,
  "EV.playC": playChosenCard,
  "EV.playD": playChosenCard,
  "FA.playA": playChosenCard,
  "MU.musterCardA": playChosenCard,
  "M5.playCharDie": playChosenCard,
  "M5.playEventDie": playChosenCard,
  "MU.musterE": musterWithCard,
  "MU.musterEnd": musterWithCard,
  "MU.polTrack": advancePoliticalTrack,
  "MU.musterMinion": musterMinion,
  "FA.bringIn": bringFactionIn,
};
const isEndBox = (label) => /^End( action)?$/.test(label);
// An End box: the walk is over; a die held for the action is spent.
function endAction(state, walk) {
  endWalk(
    state,
    walk.die ? WALK_RESULT.ACTION : WALK_RESULT.END,
    "End of " + (walk.die ? "action" : "walk") + ".",
  );
  if (walk.die) spendCurrentDie(state, "end of action");
}
export function handleAction(state, node) {
  const walk = state.walk,
    label = normalizeText(NODE.text(node));
  const claimed = claimActionDie(state, walk, node, label);
  if (claimed !== true) return claimed;
  const handler = ACTION_HANDLERS[walk.page + "." + walk.node];
  if (handler) {
    const result = handler(state, node, actionFacts(state, label));
    if (result !== FALL_THROUGH) return result;
  }
  if (isEndBox(label)) return endAction(state, walk);
  promptAction(state, node, label, { help: NODE.extra(node).help });
}
export function spendCurrentDie(state, why) {
  const walk = state.walk;
  if (!walk?.die) return;
  if (state.settings.dice && walk.dieIndex != null) {
    engine.spendDie(state, state.dice.pool[walk.dieIndex], why);
  } else
    engine.log(
      state,
      "Queller used a " +
        DIE_REQUIREMENT_NAME[walk.die] +
        " die" +
        (why ? " — " + why : "") +
        ".",
    );
  walk.die = null;
  walk.dieIndex = null;
}
// Rule 29: an action Queller cannot take is skipped — follow the arrow out of the box, or return to the page that sent us here.
export function exitAction(state) {
  if (follow(state, null)) return;
  doReturn(state);
}
