// Every change to the game: a snapshot for Undo, the action itself (rolled back if it throws), autosave and re-render.
import * as debug from "../debug.js";
import * as engine from "../qb.js";
import { showErrBar } from "./boot.js";
import { STORAGE_KEY, UNDO_DEPTH } from "./constants.js";
import { render } from "./render.js";
import { history, setState, state } from "./session.js";
import { storageSet } from "./storage.js";

function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > UNDO_DEPTH) history.shift();
}
export function commit() {
  if (state) state.appVersion = engine.VERSION;
  storageSet(STORAGE_KEY.AUTOSAVE, JSON.stringify(state));
  render();
}
// Every change to the game goes through here. `info` names the action for the debug log ({a:"answer", ...}).
// If the action throws, the game is put back as it was before it, the error is recorded and the error bar offers a debug log.
export function act(fn, info) {
  snapshot();
  debug.begin(info || { action: "act" }, state);
  try {
    fn();
  } catch (error) {
    const brokenState = state;
    setState(JSON.parse(history.pop()));
    debug.error(
      error,
      { action: "actionFailed", rolledBack: true },
      brokenState,
    );
    commit();
    showErrBar();
    return;
  }
  debug.finishAction(state);
  commit();
}
export function undo() {
  if (!history.length) return;
  debug.begin({ action: "undo" }, state);
  setState(JSON.parse(history.pop()));
  debug.finishAction(state);
  commit();
}
