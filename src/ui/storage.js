// localStorage that never throws, and a save file parsed and migrated.
import * as engine from "../qb.js";

export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full, blocked or unavailable: the game goes on in memory; the debug log's storage probe reports it.
  }
}
export function loadJSON(text) {
  const save = JSON.parse(text);
  if (!save?.settings || !save.board) throw new Error("not a Queller save");
  return engine.migrate(save);
}
