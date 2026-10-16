// Wiring: the handlers of the game screen's controls, attached after every render.
import * as engine from "../qb.js";
import { PROMPT } from "../qb.js";
import { act, undo } from "./actions.js";
import { askNewGame, openModal } from "./ask.js";
import { readBattleForm } from "./battle-form.js";
import { MODAL } from "./constants.js";
import { find, onClickEach } from "./dom.js";
import {
  onAnswer,
  onCard,
  onPhase,
  spendDieClick,
  trackerValue,
} from "./handlers.js";
import { setBattleDraft, state } from "./session.js";
import {
  DEFAULT_STEP_LIMIT,
  STEP_LIMITS,
  boardValue,
  trackerChange,
} from "./tracker.js";

// The second click of a double-click lands on whatever the first one rendered (the next prompt's button), so the
// controls that move the game on ignore it. A keyboard press is a click with detail 0.
const isRepeatClick = (event) => event?.detail > 1;
function wireHeader() {
  find("#undoBtn").onclick = undo;
  const newGameBtn = find("#newGameBtn");
  if (newGameBtn) newGameBtn.onclick = askNewGame;
}
function wireModalButtons() {
  onClickEach("[data-modal]", (button) =>
    openModal(
      button.dataset.modal,
      button.dataset.modal === MODAL.FLOW ? { current: true } : undefined,
    ),
  );
}
function wirePhaseButtons() {
  onClickEach("[data-phase]", (button, event) => {
    if (!isRepeatClick(event)) onPhase(button.dataset.phase);
  });
}
function wireAnswerButtons() {
  onClickEach("[data-ans]", (button, event) => {
    if (!isRepeatClick(event)) onAnswer(button.dataset.ans);
  });
}
// The battle form: its Nazgûl stepper, the draft that keeps its answers across a re-render, and the button that starts
// the round.
function wireBattleForm() {
  const battleFormOk = find("#bfOk");
  if (!battleFormOk) return;
  battleFormOk.onclick = (event) => {
    if (isRepeatClick(event)) return;
    const form = readBattleForm();
    act(
      () => {
        engine.answer(state, form);
        setBattleDraft(null);
      },
      { action: "answer", prompt: PROMPT.BATTLE_FORM, value: form },
    );
  };
  document.querySelectorAll(".bform input").forEach((input) => {
    input.onchange = () => setBattleDraft(readBattleForm());
  });
  onClickEach("[data-bs]", (button) => {
    const input = find("#bf-nazLead");
    const value = Math.max(
      0,
      Math.min(STEP_LIMITS.nazgul[1], (+input.value || 0) + +button.dataset.d),
    );
    input.value = value;
    find("#bf-nazLead-n").textContent = value;
    setBattleDraft(readBattleForm());
  });
}
function wireDiceSpend() {
  onClickEach("[data-spend]", (button, event) => {
    if (!isRepeatClick(event)) spendDieClick(+button.dataset.spend);
  });
}
function wireTableCards() {
  onClickEach("[data-card]", (button) =>
    onCard(button.dataset.card, button.dataset.id),
  );
}
function wireTracker() {
  document.querySelectorAll(".tracker [data-t]").forEach((el) => {
    el.onchange = () => trackerChange(el.dataset.t, trackerValue(el));
  });
}
function wireSteppers() {
  onClickEach("[data-step]", (button) => {
    const path = button.dataset.step;
    const limits = STEP_LIMITS[path] || DEFAULT_STEP_LIMIT;
    trackerChange(
      path,
      Math.min(
        limits[1],
        Math.max(limits[0], boardValue(path) + +button.dataset.d),
      ),
    );
  });
}
function wireForgetChecks() {
  const resetBtn = find("[data-t-reset]");
  if (resetBtn)
    resetBtn.onclick = () =>
      act(
        () => {
          state.situational = {};
          state.playable = {};
        },
        { action: "forgetCardChecks" },
      );
}
export function wire() {
  wireHeader();
  wireModalButtons();
  wirePhaseButtons();
  wireAnswerButtons();
  wireBattleForm();
  wireDiceSpend();
  wireTableCards();
  wireTracker();
  wireSteppers();
  wireForgetChecks();
}
