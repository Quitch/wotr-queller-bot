// The orange boxes: steps the app performs itself (dice, cards) or prompts the player to do.
import * as engine from "../engine/index.js";
import { DECK, TRAIL, cardById } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { drawStep, promptPlayCard } from "./actions.js";
import { askBoardQuestion, follow, setPrompt, trail } from "./core.js";
import { normalizeText } from "./graph.js";
import {
  FALL_THROUGH,
  PENDING,
  PROMPT,
  STRATEGY_ROLL,
  isLowRoll,
} from "./prompt.js";

// A step the app performed itself: record it and move on.
function continueStep(state, label, why) {
  trail(state, { kind: TRAIL.STEP, text: label, auto: true, why });
  follow(state, null);
}
// A step for the player to do (items: a list shown under the text; move: a movement step that may be impossible).
function promptStep(state, node, text, extra) {
  setPrompt(state, {
    type: PROMPT.STEP,
    text,
    node: state.walk.node,
    ...extra,
  });
}
const stepFacts = (state, label) => ({
  walk: state.walk,
  label,
  cardsOn: state.settings.cards,
  diceOn: state.settings.dice,
  wome: state.settings.wome,
});
function recoverDiceStep(state, node, { diceOn, wome, label }) {
  if (!diceOn)
    return promptStep(
      state,
      node,
      "Recover Queller’s Action dice" +
        (wome ? " (and the Faction die if a Shadow faction is in play)" : "") +
        ".",
    );
  engine.recoverDice(state);
  continueStep(state, label, "pool: " + state.dice.pool.length + " dice");
}
function drawTurnCardsStep(state, node, { cardsOn, wome, label }) {
  if (!cardsOn)
    return promptStep(
      state,
      node,
      "Draw one Character and one Strategy Event card for Queller" +
        (wome ? ", and one Faction Event card" : "") +
        ".",
    );
  engine.drawCard(state, DECK.CHARACTER);
  engine.drawCard(state, DECK.STRATEGY);
  if (wome) engine.drawCard(state, DECK.FACTION);
  continueStep(
    state,
    label,
    "hand: " +
      engine.handCounts(state).total +
      (wome ? " + " + engine.handCounts(state).faction + " faction" : ""),
  );
}
// "Discard one card": the card the priority list before it chose.
function discardChosenStep(state, node, { walk, cardsOn, label }) {
  if (!cardsOn || !walk.chosen) return FALL_THROUGH;
  const id = walk.chosen;
  engine.discardCard(
    state,
    id,
    ["hand above the limit", ...(walk.steps || [])].join("; "),
  );
  walk.chosen = null;
  continueStep(state, label, "discarded “" + cardById[id].title + "”");
}
// The game minimum of 1 Hunt die (rulebook p.20: Fellowship dice were in the Hunt Box at the end of the previous turn),
// asked once per node when the flowchart gives 0 dice; turn 1 has no previous turn. True, false, or PENDING.
const huntPart = (walk, name) => walk.page + "." + walk.node + "." + name;
function huntMinimumApplies(state) {
  if (state.turn === 1) return false;
  return askBoardQuestion(
    state,
    huntPart(state.walk, "huntMinimum"),
    "Did the Free Peoples take a die out of the Hunt Box in Phase 1",
  );
}
// Place `count` dice (dice on) or tell the player to (dice off); `roll` is the app's hunt allocation roll, if any.
function placeHuntDice(state, node, { diceOn, label }, count, roll, minimum) {
  const notes = [
    roll == null ? "" : "rolled " + roll,
    minimum ? "the game minimum" : "",
  ].filter(Boolean);
  if (!diceOn)
    return promptStep(
      state,
      node,
      "Assign " +
        count +
        (count === 1 ? " die" : " dice") +
        " to the Hunt Box" +
        (notes.length ? " (" + notes.join("; ") + ")" : "") +
        ".",
    );
  if (count) engine.assignHunt(state, count);
  else engine.log(state, "No dice placed in the Hunt Box before rolling.");
  continueStep(
    state,
    label,
    (roll == null ? "" : "rolled " + roll + " → ") +
      count +
      " in the Hunt Box" +
      (minimum ? " (the game minimum)" : ""),
  );
}
// The flowchart's 0 dice, unless the minimum applies; `offStep` (dice off, nothing placed) is the player's step.
function zeroHuntDiceOrMinimum(state, node, facts, roll, offStep) {
  const minimum = huntMinimumApplies(state);
  if (minimum === PENDING) return minimum;
  if (!minimum && !facts.diceOn && offStep) return offStep();
  placeHuntDice(state, node, facts, minimum ? 1 : 0, roll, minimum);
}
// The app's roll is kept in walk.parts, so a re-run (after the minimum question, or after dice were switched on or off
// mid-walk) never rolls again. With dice off and no roll, the minimum is asked first (it makes the player's roll moot).
function rollHuntAllocationStep(state, node, facts) {
  const { walk, diceOn, label } = facts;
  const rollPart = huntPart(walk, "huntRoll");
  if (diceOn && !(rollPart in walk.parts)) {
    walk.parts[rollPart] = engine.randomBelow(6) + 1;
    engine.log(
      state,
      "Rolled " + walk.parts[rollPart] + " for the hunt allocation.",
    );
  }
  const roll = walk.parts[rollPart];
  if (roll == null)
    return zeroHuntDiceOrMinimum(state, node, facts, null, () =>
      promptStep(state, node, label),
    );
  if (!isLowRoll(roll)) return placeHuntDice(state, node, facts, 1, roll);
  return zeroHuntDiceOrMinimum(state, node, facts, roll);
}
function huntMaxStep(state, node, { diceOn, label }) {
  if (!diceOn)
    return promptStep(
      state,
      node,
      label + " (up to the number of Companions, minimum 1).",
    );
  const placed = engine.assignHunt(state, engine.huntCap(state));
  continueStep(
    state,
    label,
    placed + " dice (Companions: " + (state.board.fs.companions ?? 0) + ")",
  );
}
// "Assign N dice to the Hunt box": rule 41 may cap the number.
const huntFixedStep = (count) =>
  function huntStep(state, node, { diceOn, label }) {
    if (!diceOn) return FALL_THROUGH;
    const placed = engine.assignHunt(state, count);
    continueStep(
      state,
      label,
      placed < count
        ? "capped at " +
            placed +
            " (rule 41: " +
            (state.board.fs.companions ?? 0) +
            " Companions)"
        : undefined,
    );
  };
const huntNoneStep = (state, node, facts) =>
  zeroHuntDiceOrMinimum(state, node, facts, null, () => FALL_THROUGH);
function rollRemainingStep(state, node, { diceOn, label }) {
  if (!diceOn)
    return promptStep(
      state,
      node,
      "Roll Queller’s remaining Action dice. Put every Eye in the Hunt Box.",
    );
  const faces = engine.rollRemaining(state);
  continueStep(state, label, faces.join(", "));
}
// "Roll a die" at the start of the game: 1-3 corruption, 4-6 military.
function strategyRollStep(state, node, { diceOn }) {
  if (!diceOn)
    return setPrompt(state, {
      type: PROMPT.ROLL,
      text: "Roll a die: 1-3 Corruption strategy, 4-6 Military strategy.",
      node: state.walk.node,
      options: [STRATEGY_ROLL.LOW, STRATEGY_ROLL.HIGH],
    });
  const roll = engine.randomBelow(6) + 1;
  engine.log(state, "Strategy roll: " + roll + ".");
  trail(state, {
    kind: TRAIL.STEP,
    text: "Roll a die",
    auto: true,
    why: "rolled " + roll,
  });
  follow(state, isLowRoll(roll) ? STRATEGY_ROLL.LOW : STRATEGY_ROLL.HIGH);
}
function playCombatCardStep(state, node, { walk, cardsOn, label }) {
  if (!cardsOn) return FALL_THROUGH;
  if (walk.chosen)
    return promptPlayCard(state, node, walk.chosen, "Play combat card", {
      combat: true,
    });
  continueStep(state, label, "no card to play");
}
// The step boxes the app can perform itself, keyed by page and node id. A handler returns FALL_THROUGH to leave the box
// to the generic prompt.
const STEP_HANDLERS = {
  "C14.rec": recoverDiceStep,
  "M14.rec": recoverDiceStep,
  "C14.draw": drawTurnCardsStep,
  "M14.draw": drawTurnCardsStep,
  "C14.discOne14": discardChosenStep,
  "C14.discOne18": discardChosenStep,
  "M14.discOne": discardChosenStep,
  "C14.discOneF": discardChosenStep,
  "M14.discOneF": discardChosenStep,
  "C14.rollHunt": rollHuntAllocationStep,
  "C14.huntMax": huntMaxStep,
  "M14.huntMax": huntMaxStep,
  "C14.hunt1a": huntFixedStep(1),
  "C14.hunt1b": huntFixedStep(1),
  "M14.hunt1": huntFixedStep(1),
  "C14.hunt2a": huntFixedStep(2),
  "C14.hunt2b": huntFixedStep(2),
  "M14.hunt2": huntFixedStep(2),
  "M14.hunt0": huntNoneStep,
  "C14.rollRest": rollRemainingStep,
  "M14.rollRest": rollRemainingStep,
  "C14.sogRoll": strategyRollStep,
  "M14.sogRoll": strategyRollStep,
  "BA.playCard": playCombatCardStep,
  "FA.drawT": drawStep,
  "EV.drawPrefT": drawStep,
};
function promptGenericStep(state, node, label) {
  promptStep(state, node, label, {
    items: NODE.extra(node).items,
    move: label.startsWith("Move"),
  });
}
export function handleStep(state, node) {
  const walk = state.walk,
    label = normalizeText(NODE.text(node));
  const handler = STEP_HANDLERS[walk.page + "." + walk.node];
  if (handler) {
    const result = handler(state, node, stepFacts(state, label));
    if (result !== FALL_THROUGH) return result;
  }
  promptGenericStep(state, node, label);
}
