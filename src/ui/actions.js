// Every change to the game: a snapshot for Undo, the action itself (rolled back if it or drawing the game throws),
// autosave and re-render.
import * as debug from "../debug.js";
import * as engine from "../qb.js";
import { showErrBar, showStorageNotice } from "./boot.js";
import { STORAGE_KEY, UNDO_DEPTH } from "./constants.js";
import { gameHTML, render } from "./render.js";
import { history, restoreState, state } from "./session.js";
import { storageSet } from "./storage.js";

function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > UNDO_DEPTH) history.shift();
}
// The page is built before the autosave is written, so a game that cannot be drawn never replaces the autosave.
export function commit() {
  if (state) {
    state.appVersion = engine.VERSION;
    gameHTML();
  }
  if (!storageSet(STORAGE_KEY.AUTOSAVE, JSON.stringify(state)))
    showStorageNotice();
  render();
}
// Every change to the game goes through here. `info` names the action for the debug log ({a:"answer", ...}).
// If the action or drawing its result throws, the game is put back as it was before it, the error is recorded and the
// error bar offers a debug log. The autosave is written back too, in case only wiring the page failed after it was saved.
export function act(fn, info) {
  snapshot();
  debug.begin(info || { action: "act" }, state);
  try {
    fn();
    commit();
  } catch (error) {
    const brokenState = state;
    restoreState(JSON.parse(history.pop()));
    debug.error(
      error,
      { action: "actionFailed", rolledBack: true },
      brokenState,
    );
    storageSet(STORAGE_KEY.AUTOSAVE, JSON.stringify(state));
    render();
    showErrBar();
    return;
  }
  debug.finishAction(state);
}
export function undo() {
  if (!history.length) return;
  debug.begin({ action: "undo" }, state);
  restoreState(JSON.parse(history.pop()));
  debug.finishAction(state);
  commit();
}
