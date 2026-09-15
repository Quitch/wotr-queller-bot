// Which cards are playable, asking the player about each condition the app cannot judge (answers are cached per turn).
import * as engine from "../engine/index.js";
import { cardById } from "../engine/index.js";
import { setPrompt } from "./core.js";
import { PENDING, PROMPT } from "./prompt.js";

// A card's precondition in this context: the combat test in a battle, the board test when the tracker is on, otherwise taken as met.
function playablePre(state, card, id, ctx) {
  if (ctx === "combat") return engine.combatPrecondition(state, card);
  return state.settings.tracker ? engine.precondition(state, id) : true;
}
export function evalPlayable(state, ids, ctx) {
  const out = [];
  for (const id of ids) {
    const card = cardById[id];
    const cacheKey = (ctx === "combat" ? "B:" : "") + id;
    if (state.playable[cacheKey] !== undefined) {
      if (state.playable[cacheKey]) out.push(id);
      continue;
    }
    const met = playablePre(state, card, id, ctx);
    if (met && typeof met === "object") {
      setPrompt(state, {
        type: PROMPT.SITUATIONAL,
        key: met.key,
        text: met.q,
      });
      return PENDING;
    }
    if (!met) {
      state.playable[cacheKey] = false;
      continue;
    }
    setPrompt(state, { type: PROMPT.CONFIRM, card: id, ctx });
    return PENDING;
  }
  return out;
}
