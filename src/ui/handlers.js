// What the controls do: answers, die taps, phase buttons, table cards, and what follows a finished walk.
import * as debug from "../debug.js";
import * as engine from "../qb.js";
import {
  DIE_KIND,
  DIE_STATE,
  PHASE,
  WALK_RESULT,
  YES_NO_PROMPTS,
  cardById,
  phaseFromResult,
} from "../qb.js";
import { act } from "./actions.js";
import { ask, openModal } from "./ask.js";
import { MODAL } from "./constants.js";
import { PHASE_BY_LABEL } from "./header.js";
import { render } from "./render.js";
import { setShownCard, shownCard, state } from "./session.js";
import { PHASE_ACTION } from "./walkthrough.js";

export function onAnswer(answer) {
  const walk = state.walk,
    prompt = walk?.prompt;
  if (!prompt) return;
  act(
    () => {
      let value = answer;
      if (YES_NO_PROMPTS.includes(prompt.type)) value = answer === "yes";
      engine.answer(state, value);
      afterWalk();
    },
    {
      action: "answer",
      prompt: prompt.type,
      page: walk.page,
      node: walk.node,
      text: prompt.text ? String(prompt.text).slice(0, 80) : undefined,
      card: prompt.card,
      value: answer,
    },
  );
}
// A tracker field's value: checkboxes give a boolean, numeric fields a number, the rest their text.
export function trackerValue(el) {
  if (el.type === "checkbox") return el.checked;
  return el.dataset.num ? +el.value : el.value;
}
// The player marks an available die as used by hand (the [data-spend] buttons in the dice row).
export function spendDieClick(index) {
  const die = state.dice.pool[index];
  if (die?.status !== DIE_STATE.AVAIL) return;
  ask({
    title: "Mark this die as used?",
    text:
      "The " +
      die.face +
      (die.kind === DIE_KIND.FACTION ? " Faction" : "") +
      " die will be marked as used for the rest of this turn. Undo reverses it.",
    buttons: [
      { v: "ok", label: "Mark as used", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      if (choice !== "ok") return;
      act(
        () => {
          const dieNow = state.dice.pool[index];
          if (dieNow?.status === DIE_STATE.AVAIL)
            engine.spendDie(state, dieNow, "marked by you");
        },
        { action: "spendDie", index, face: die.face },
      );
    },
  });
}
// After a walk ends: remember whether a battle is still open, and move the phase on when the walk reached the next start point.
export function afterWalk() {
  const walk = state.walk;
  if (!walk?.done) return;
  const result = walk.result || "";
  if (walk.entry.page === "BA") {
    state.battleOpen = result === WALK_RESULT.BATTLE_NEXT;
  } else if (result !== "") {
    state.battleOpen = false;
  }
  if (result === WALK_RESULT.STRATEGY) {
    state.phase = PHASE.P1;
  } else if (phaseFromResult(result)) {
    const phase = PHASE_BY_LABEL[phaseFromResult(result)];
    if (phase) state.phase = phase;
  }
}
export function onPhase(id) {
  act(
    () => {
      if (id === PHASE_ACTION.ABANDON) {
        state.walk = null;
        engine.log(state, "Walk abandoned.");
        return;
      }
      if (id === PHASE_ACTION.NEXT_TURN) {
        engine.nextTurn(state);
        return;
      }
      if (id === PHASE.P6) {
        state.phase = PHASE.P6;
        state.walk = null;
        engine.log(
          state,
          "Phase 6: check victory conditions (Shadow VP 10, Corruption 12, Ring destroyed).",
        );
        return;
      }
      if (id === PHASE_ACTION.BATTLE_1) {
        engine.startBattle(state, 1);
        afterWalk();
        return;
      }
      if (id === PHASE_ACTION.BATTLE_2) {
        engine.startBattle(state, 2);
        afterWalk();
        return;
      }
      if (id === PHASE_ACTION.JUMP_TO) {
        openModal(MODAL.JUMP);
        return;
      }
      if (id === PHASE.SETUP) {
        engine.startPhase(state, PHASE.SETUP);
        afterWalk();
        return;
      }
      engine.startPhase(state, id);
      afterWalk();
    },
    { action: "phase", id },
  );
}
export function onCard(action, id) {
  if (action === "discard") {
    const card = cardById[id];
    ask({
      title: "Discard “" + card.title + "”?",
      text: "Do this when the card’s own text says it must be discarded, or when a Free Peoples action discards it. It goes to the discard pile.",
      buttons: [
        { v: "ok", label: "Discard", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (choice) => {
        if (choice !== "ok") return;
        act(
          () => {
            engine.discardCard(state, id, "discarded from the table");
            if (shownCard === id) setShownCard(null);
          },
          { action: "discardTable", card: id },
        );
      },
    });
    return;
  }
  setShownCard(action === "show" ? id : null);
  debug.action(
    { action: "tableCard", show: action === "show", card: id },
    state,
  );
  render();
}
