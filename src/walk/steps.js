// The orange boxes: steps the app performs itself (dice, cards) or prompts the player to do.
import * as engine from "../engine/index.js";
import { DECK, HAND, TRAIL, cardById } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { drawStep, promptPlayCard } from "./actions.js";
import { follow, setPrompt, trail } from "./core.js";
import { normalizeText } from "./graph.js";
import { FALL_THROUGH, PROMPT, STRATEGY_ROLL, isLowRoll } from "./prompt.js";

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
      "Recover Queller’s action dice" +
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
// "Discard priority": discard the hand down to its limit by the box's priority list.
const discardToLimitStep = (hand) =>
  function discardStep(state, node, { cardsOn, label }) {
    const items = NODE.extra(node).items;
    if (!cardsOn) return promptStep(state, node, label, { items });
    const discarded = engine.autoDiscard(state, items, hand);
    continueStep(
      state,
      label,
      "discarded " +
        discarded.map((id) => "“" + cardById[id].title + "”").join(", "),
    );
  };
function rollHuntAllocationStep(state, node, { diceOn, label }) {
  if (!diceOn) return promptStep(state, node, label);
  const roll = engine.randomBelow(6) + 1;
  const placed = isLowRoll(roll) ? 0 : 1;
  engine.log(
    state,
    "Rolled " + roll + " for the hunt allocation → " + placed + " dice.",
  );
  engine.assignHunt(state, placed);
  continueStep(
    state,
    label,
    "rolled " + roll + " → " + placed + " in the Hunt box",
  );
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
// "Assign N dice to the Hunt box": rule 34 may cap the number.
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
            " (rule 34: " +
            (state.board.fs.companions ?? 0) +
            " Companions)"
        : undefined,
    );
  };
function huntNoneStep(state, node, { diceOn, label }) {
  if (!diceOn) return FALL_THROUGH;
  engine.log(state, "No dice placed in the Hunt box before rolling.");
  continueStep(state, label);
}
function rollRemainingStep(state, node, { diceOn, label }) {
  if (!diceOn)
    return promptStep(
      state,
      node,
      "Roll Queller’s remaining action dice. Put every Eye in the Hunt box.",
    );
  const faces = engine.rollRemaining(state);
  continueStep(state, label, faces.join(", "));
}
// "Roll a die" at the start of the game: 1-3 corruption, 4-6 military.
function strategyRollStep(state, node, { diceOn }) {
  if (!diceOn)
    return setPrompt(state, {
      type: PROMPT.ROLL,
      text: "Roll a die: 1-3 corruption strategy, 4-6 military strategy.",
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
  "C14.disc14": discardToLimitStep(HAND.EVENT),
  "C14.disc18": discardToLimitStep(HAND.EVENT),
  "M14.disc": discardToLimitStep(HAND.EVENT),
  "C14.discF": discardToLimitStep(HAND.FACTION),
  "M14.discF": discardToLimitStep(HAND.FACTION),
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
