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
// Force a Free Peoples protection card off the table (A Power too Great, The Power of Tom Bombadil). The button looks the
// same whatever Queller holds; whether the cost can be paid is told only after the player confirms.
export function onForceDiscard(key) {
  const fpCard = engine.FP_PROTECTION_CARDS.find((c) => c.key === key);
  const told = (title, text) =>
    ask({
      title,
      text,
      buttons: [{ v: "ok", label: "OK", primary: true }],
      onPick: () => {},
    });
  ask({
    title: "Force “" + fpCard.title + "” off the table?",
    text:
      "Queller can discard this Free Peoples card by using one Action die and discarding one Army Event card and one Character card from its hand. Do this when a Queller army is blocked from " +
      fpCard.regions +
      " by the card and you would otherwise press Not possible." +
      (state.settings.dice
        ? ""
        : " The app does not roll Queller’s dice: set aside one Queller Action die yourself."),
    buttons: [
      { v: "ok", label: "Force the discard", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      if (choice !== "ok") return;
      const cost = engine.forcedDiscardCost(state);
      if (cost.blocked) {
        debug.action(
          { action: "forceDiscard", card: key, blocked: cost.blocked },
          state,
        );
        told(
          "Queller cannot pay",
          cost.blocked === engine.FORCED_DISCARD_BLOCK.DIE
            ? "Queller has no unused Action die. “" +
                fpCard.title +
                "” stays on the table."
            : "Queller cannot pay the cost now. “" +
                fpCard.title +
                "” stays on the table.",
        );
        return;
      }
      act(() => engine.payForcedDiscard(state, key), {
        action: "forceDiscard",
        card: key,
      });
      told(
        "“" + fpCard.title + "” discarded",
        "Queller paid the cost. Discard “" +
          fpCard.title +
          "” from the table on the board.",
      );
    },
  });
}
