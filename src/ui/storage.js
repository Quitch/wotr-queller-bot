// localStorage that never throws, and a save file parsed and migrated.
import * as engine from "../qb.js";

export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
// false when storage is full, blocked or unavailable: the game goes on in memory.
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function loadJSON(text) {
  const save = JSON.parse(text);
  if (!save?.settings || !save.board) throw new Error("not a Queller save");
  return engine.migrate(save);
}
