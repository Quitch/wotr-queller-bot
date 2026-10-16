// The game and its undo stack, the open modal ({name, arg}), the table card whose details are shown and the battle
// form's unsubmitted answers (the shape of state.battle, or null). Other modules read these as live bindings and
// change them through the setters (an imported binding cannot be assigned).
export let state = null;
export let history = [];
export let modal = null;
export let shownCard = null;
export let battleDraft = null;
// A different game (new, loaded, or none): the battle form's draft belonged to the old one.
export function setState(value) {
  state = value;
  battleDraft = null;
}
// The same game as it was before an action (Undo, a rolled-back action): the battle form's draft is kept.
export function restoreState(value) {
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
export function setBattleDraft(form) {
  battleDraft = form;
}
