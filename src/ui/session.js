// The game and its undo stack, the open modal ({name, arg}) and the table card whose details are shown. Other modules
// read these as live bindings and change them through the setters (an imported binding cannot be assigned).
export let state = null;
export let history = [];
export let modal = null;
export let shownCard = null;
export function setState(value) {
  state = value;
}
export function setHistory(value) {
  history = value;
}
export function setModal(spec) {
  modal = spec;
}
export function setShownCard(id) {
  shownCard = id;
}
