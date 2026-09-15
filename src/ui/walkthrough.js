// The walkthrough panel: start-point buttons by phase, the open prompt or the result, the trail and the log.
import { FLOW } from "../flow/index.js";
import * as engine from "../qb.js";
import { DIE_STATE, PHASE, STRATEGY } from "../qb.js";
import { escapeHTML } from "./dom.js";
import { promptHTML } from "./prompts.js";
import { state } from "./session.js";
import { logHTML, resultHTML, trailHTML } from "./trail.js";

// The walkthrough panel: start-point buttons, the open prompt or the walk's result, the trail and the log.
export function walkHTML(extra) {
  let html =
    '<section class="panel" aria-labelledby="h-walk"><h2 class="ph" id="h-walk">Walkthrough</h2>';
  html += phaseButtonsHTML();
  const walk = state.walk;
  if (walk && !walk.done) {
    html += promptHTML(walk);
  } else if (walk?.done) {
    html += resultHTML(walk);
  } else html += '<div class="idle">' + idleText() + "</div>";
  // data-key names the walk, so ui/render.js keeps the player's open/closed choice while it lasts and returns to the
  // default (open while walking, closed once done) when a walk starts or ends
  if (walk)
    html +=
      '<details data-key="' +
      escapeHTML(walk.entry.page + "|" + walk.entry.start) +
      "|" +
      state.turn +
      (walk.done ? "|done" : "") +
      '"' +
      (walk.done ? "" : " open") +
      "><summary>Walk trail — " +
      escapeHTML(FLOW[walk.entry.page].name) +
      " from “" +
      escapeHTML(engine.normalizeText(walk.entry.start)) +
      "” (" +
      walk.trail.length +
      " steps)</summary>" +
      trailHTML(walk) +
      "</details>";
  html += "</section>" + (extra || "") + logHTML();
  return html;
}
// The data-phase values of the walkthrough's buttons: a phase to start, or one of these.
export const PHASE_ACTION = {
  ABANDON: "abandon",
  NEXT_TURN: "next",
  JUMP_TO: "jumpto",
  BATTLE_1: "battle1",
  BATTLE_2: "battle2",
};
function idleText() {
  switch (state.phase) {
    case PHASE.SETUP:
      return "Roll a die to choose Queller’s starting strategy (Start of game box).";
    case PHASE.P1:
      return "Phase 1: recover Queller’s dice, draw cards and check the hand limit.";
    case PHASE.P2:
      return state.strategy === STRATEGY.CORRUPTION
        ? "Phase 2: declare or hide your Fellowship, then check whether Queller changes strategy."
        : "Phase 2: declare or hide your Fellowship. The military strategy has nothing to do here.";
    case PHASE.P3:
      return "Phase 3: Queller allocates dice to the Hunt box.";
    case PHASE.P4:
      return "Phase 4: roll Queller’s remaining dice (Eyes go to the Hunt box). Roll your own dice too.";
    case PHASE.P5:
      return "Phase 5: you act first. Each time Queller is eligible to act, walk from “Phase 5”. Walk the Battle page for each combat round.";
    case PHASE.P6:
      return "Phase 6: victory check.";
  }
  return "";
}
const phaseBtn = (id, label, primary) =>
  '<button class="btn ' +
  (primary ? "primary" : "") +
  '" data-phase="' +
  id +
  '">' +
  label +
  "</button>";
// The start-point buttons offered in each phase (the military strategy has no Phase 2).
const PHASE_BUTTONS = {
  [PHASE.SETUP]: () => [phaseBtn(PHASE.SETUP, "Start of game", true)],
  [PHASE.P1]: () => [phaseBtn(PHASE.P1, "Phase 1", true)],
  [PHASE.P2]: () => [
    state.strategy === STRATEGY.CORRUPTION
      ? phaseBtn(PHASE.P2, "Phase 2", true)
      : phaseBtn(PHASE.P3, "Phase 3", true),
  ],
  [PHASE.P3]: () => [phaseBtn(PHASE.P3, "Phase 3", true)],
  [PHASE.P4]: () => [phaseBtn(PHASE.P4, "Phase 4", true)],
  [PHASE.P5]: () => {
    const buttons = [
      dicePoolSpent()
        ? phaseBtn(PHASE.P6, "Phase 6", true)
        : phaseBtn(PHASE.P5, "Phase 5", true),
      state.battleOpen
        ? phaseBtn(PHASE_ACTION.BATTLE_2, "Battle (next round)")
        : phaseBtn(PHASE_ACTION.BATTLE_1, "Battle"),
    ];
    if (!state.settings.dice) buttons.push(phaseBtn(PHASE.P6, "Phase 6"));
    return buttons;
  },
  [PHASE.P6]: () => [
    phaseBtn(
      PHASE_ACTION.NEXT_TURN,
      "Phase 1 (turn " + (state.turn + 1) + ")",
      true,
    ),
  ],
};
function phaseButtonsHTML() {
  const buttons = [];
  const phase = state.phase;
  const busy = state.walk && !state.walk.done;
  if (busy) {
    buttons.push(
      '<button class="btn small ghost" data-phase="' +
        PHASE_ACTION.ABANDON +
        '">Abandon this walk</button>',
    );
  } else if (PHASE_BUTTONS[phase]) buttons.push(...PHASE_BUTTONS[phase]());
  if (!busy && phase !== PHASE.SETUP)
    buttons.push(
      '<button class="btn small ghost" data-phase="' +
        PHASE_ACTION.JUMP_TO +
        '">Other start point…</button>',
    );
  return (
    '<div class="phasebar"><span class="lbl">' +
    (busy ? "Walking" : "Start point") +
    "</span>" +
    buttons.join("") +
    "</div>"
  );
}
// With dice tracked, Phase 6 replaces Phase 5 once Queller has no usable die left (available or set aside for a minion).
function dicePoolSpent() {
  return (
    state.settings.dice &&
    state.dice.pool.length > 0 &&
    !state.dice.pool.some(
      (die) =>
        die.status === DIE_STATE.AVAIL || die.status === DIE_STATE.RESERVED,
    )
  );
}
