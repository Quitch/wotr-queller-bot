// The game log kept in the state.
import { LOG_CAP } from "./constants.js";

export function log(state, text, extra) {
  state.log.push({ text, turn: state.turn, ...extra });
  if (state.log.length > LOG_CAP) state.log.shift();
}
