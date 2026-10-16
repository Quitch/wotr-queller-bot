// What the controls do: answers, die taps, phase buttons and table cards.
import * as debug from "../debug.js";
import * as engine from "../qb.js";
import { DIE_KIND, DIE_STATE, PHASE, YES_NO_PROMPTS, cardById } from "../qb.js";
import { act } from "./actions.js";
import { ask, openModal } from "./ask.js";
import { MODAL } from "./constants.js";
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
      engine.afterWalk(state);
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
// Opening Jump changes nothing in the game, so it is not an Undo step (and act's re-render would replace its opener).
export function onPhase(id) {
  if (id === PHASE_ACTION.JUMP_TO) {
    openModal(MODAL.JUMP);
    return;
  }
  act(
    () => {
      const finishedBefore = state.walk?.done ? state.walk : null;
      if (id === PHASE_ACTION.ABANDON) {
        engine.abandonWalk(state);
        engine.log(state, "Walk abandoned.");
        return;
      }
      if (id === PHASE_ACTION.NEXT_TURN) {
        engine.nextTurn(state);
        return;
      }
      if (id === PHASE.P6) {
        state.phase = PHASE.P6;
        engine.abandonWalk(state);
        engine.log(
          state,
          "Phase 6: check victory conditions (Shadow VP 10, Corruption 12, Ring destroyed).",
        );
        return;
      }
      if (id === PHASE_ACTION.BATTLE_1) {
        engine.startBattle(state, 1);
        engine.afterWalk(state, finishedBefore);
        return;
      }
      if (id === PHASE_ACTION.BATTLE_2) {
        engine.startBattle(state, 2);
        engine.afterWalk(state, finishedBefore);
        return;
      }
      if (id === PHASE.SETUP) {
        engine.startPhase(state, PHASE.SETUP);
        engine.afterWalk(state, finishedBefore);
        return;
      }
      engine.startPhase(state, id);
      engine.afterWalk(state, finishedBefore);
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
