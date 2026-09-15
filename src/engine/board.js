// Board queries: the Political Track, factions, Elven Rings, the Hunt box cap and which minion can be mustered.
import {
  FP_NATIONS,
  FP_STANCE,
  MINION_STATUS,
  SHADOW_FACTIONS,
  SHADOW_NATIONS,
} from "./constants.js";

// Shadow nations on the Political Track: nations.sauron/isengard/se = steps above "At War" (0 = At War, 1-3 = Active +N). Start: Sauron 1, Isengard 1, S&E 2.
export const SHADOW_NATION_START = { sauron: 1, isengard: 1, se: 2 };
export function shadowNationAtWar(state, nation) {
  return (state.board.nations[nation] ?? 0) === 0;
}
export function allShadowNationsAtWar(state) {
  return SHADOW_NATIONS.every((nation) => shadowNationAtWar(state, nation));
}
export function politicalTrackLabel(steps) {
  return steps === 0 ? "At War" : "Active +" + steps;
}
export function fpNationAtWar(state) {
  return FP_NATIONS.some(
    (nation) => state.board.nations[nation] === FP_STANCE.WAR,
  );
}
export function allFPNationsAtWar(state) {
  return FP_NATIONS.every(
    (nation) => state.board.nations[nation] === FP_STANCE.WAR,
  );
}
// A minion's tracker field holds a MINION_STATUS; only "in play" counts for the dice pool and the card preconditions.
export function minionInPlay(state, key) {
  return state.board.chars[key] === MINION_STATUS.IN_PLAY;
}
export function shadowFactionInPlay(state) {
  return (
    state.settings.wome &&
    SHADOW_FACTIONS.some((factionKey) => state.board.factions[factionKey])
  );
}
export function allShadowFactionsInPlay(state) {
  return SHADOW_FACTIONS.every(
    (factionKey) => state.board.factions[factionKey],
  );
}
// Whether the app knows how many Elven Rings the Shadow holds: the full tracker has the field, and so does the minimal tracker when dice are rolled.
export function ringsKnown(state) {
  return !!(state.settings.tracker || state.settings.dice);
}
export function ringAvailable(state) {
  return (
    !state.ringUsedThisTurn && (!ringsKnown(state) || state.board.rings > 0)
  );
}
// Hunt box maximum (rulebook: the number of Companions, but always at least one) — rule 34 caps the flowchart allocations at it.
export function huntCap(state) {
  return Math.max(1, state.board.fs.companions ?? 0);
}
// Minions Queller could muster now, in priority order (Muster page); the first is the one it musters. A minion is
// offered only while available (not in play and not eliminated) and its card's condition holds.
export function minionsAvailable(state) {
  const chars = state.board.chars,
    out = [];
  const available = (key) => chars[key] === MINION_STATUS.AVAILABLE;
  if (available("saruman") && shadowNationAtWar(state, "isengard"))
    out.push({ name: "Saruman", key: "saruman", why: "Isengard at war" });
  if (
    available("witchKing") &&
    shadowNationAtWar(state, "sauron") &&
    fpNationAtWar(state)
  )
    out.push({
      name: "Witch King",
      key: "witchKing",
      why: "Sauron at war and a Free Peoples nation at war",
    });
  // The Mouth of Sauron (second edition card): all Free Peoples nations At War, or the Fellowship on the Mordor track.
  if (available("mouth")) {
    if (state.board.fs.mordor)
      out.push({
        name: "Mouth of Sauron",
        key: "mouth",
        why: "the Fellowship is on the Mordor track",
      });
    else if (allFPNationsAtWar(state))
      out.push({
        name: "Mouth of Sauron",
        key: "mouth",
        why: "all Free Peoples nations at war",
      });
  }
  return out;
}
