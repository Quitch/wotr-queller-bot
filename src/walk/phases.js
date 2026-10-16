// The phase driver: which page a phase walks, starting a phase or a battle round, what follows a finished walk, the
// next turn.
import * as engine from "../engine/index.js";
import { PHASE, PHASE_LABEL, STRATEGY } from "../engine/index.js";
import { abandonWalk, beginWalk } from "./core.js";
import { normalizeText } from "./graph.js";
import { PROMPT, WALK_RESULT, phaseFromResult } from "./prompt.js";
import { run, startWalk } from "./run.js";

export function phasePage(state) {
  return state.strategy === STRATEGY.MILITARY ? "M14" : "C14";
}
export function phase5Page(state) {
  return state.strategy === STRATEGY.MILITARY ? "M5" : "C5";
}
export function startPhase(state, phase) {
  const page = phasePage(state);
  if (phase === PHASE.SETUP) {
    startWalk(state, "C14", "Start of game");
    return;
  }
  if (phase === PHASE.P1) {
    state.phase = PHASE.P1;
    startWalk(state, page, "Phase 1");
    return;
  }
  if (phase === PHASE.P2) {
    state.phase = PHASE.P2;
    if (state.strategy === STRATEGY.CORRUPTION)
      startWalk(state, "C14", "Phase 2");
    return;
  }
  if (phase === PHASE.P3) {
    state.phase = PHASE.P3;
    startWalk(state, page, "Phase 3");
    return;
  }
  if (phase === PHASE.P4) {
    state.phase = PHASE.P4;
    startWalk(state, page, "Phase 4");
    return;
  }
  if (phase === PHASE.P5) {
    state.phase = PHASE.P5;
    startWalk(state, phase5Page(state), "Phase 5");
  }
}
export function startBattle(state, round) {
  beginWalk(state, "BA", round === 1 ? "Battle" : "Battle (next round)", {
    battleRound: round,
  });
  if (state.settings.cards) {
    state.walk.prompt = {
      type: PROMPT.BATTLE_FORM,
      round,
      text: "Battle details (used to judge which combat cards Queller can play)",
    };
  } else run(state);
}
// The phase a walk's end point names ("Phase 5" → p5).
const PHASE_BY_LABEL = Object.fromEntries(
  Object.entries(PHASE_LABEL).map(([phase, label]) => [label, phase]),
);
// After a walk ends: remember whether a battle is still open, and move the phase on when the walk reached the next start point.
// finishedBefore is the walk that was already done when the action began: a phase that starts no walk (Phase 2 under
// the Military strategy) leaves it in place, and its end point must not be applied a second time.
export function afterWalk(state, finishedBefore = null) {
  const walk = state.walk;
  if (!walk?.done || walk === finishedBefore) return;
  const result = walk.result || "";
  if (walk.entry.page === "BA") {
    state.battleOpen = result === WALK_RESULT.BATTLE_NEXT;
  } else if (result !== "" && normalizeText(walk.entry.start) === "Phase 5") {
    // only Queller's next Phase 5 walk ends a battle: a walk from the Jump modal (a card's choice, rule 16) does not
    state.battleOpen = false;
  }
  if (result === WALK_RESULT.STRATEGY) {
    state.phase = PHASE.P1;
  } else if (phaseFromResult(result)) {
    const phase = PHASE_BY_LABEL[phaseFromResult(result)];
    if (phase) state.phase = phase;
  }
}
export function nextTurn(state) {
  abandonWalk(state);
  state.turn++;
  state.phase = PHASE.P1;
  state.situational = {};
  state.playable = {};
  state.battle = null;
  state.battleOpen = false;
  state.ringUsedThisTurn = false;
  state.messengerUsedThisTurn = false;
  engine.log(state, "— Turn " + state.turn + " —");
}
