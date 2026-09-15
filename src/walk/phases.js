// The phase driver: which page a phase walks, starting a phase or a battle round, the next turn.
import * as engine from "../engine/index.js";
import { PHASE, STRATEGY } from "../engine/index.js";
import { beginWalk } from "./core.js";
import { PROMPT } from "./prompt.js";
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
    state.walk = null;
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
  state.walk = null;
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
export function nextTurn(state) {
  state.turn++;
  state.phase = PHASE.P1;
  state.walk = null;
  state.situational = {};
  state.playable = {};
  state.battle = null;
  state.battleOpen = false;
  state.ringUsedThisTurn = false;
  engine.log(state, "— Turn " + state.turn + " —");
}
