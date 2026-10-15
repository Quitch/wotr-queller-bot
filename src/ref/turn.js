// The turn sequence: [[phase, text], ...].
// Reference text from "Queller Bot for War of the Ring" v3.3, draft of 2026-10-15 (Quitch, CC BY-NC 4.0). Data only; ui/ and
// modals/ render it.
// In any text, *term* marks a glossary term (rendered as a tooltip link) and "\n•" starts a bullet line.
export const TURN = [
  [
    "Phase 1",
    "Recover the Queller dice. Draw one Character and one Strategy Event card (and one Faction Event card with WoME). Walk the Phases 1–4 flowchart from “Phase 1”.",
  ],
  [
    "Phase 2",
    "Declare your Fellowship or change the Guide (game rules). Corruption strategy: walk from “Phase 2”.",
  ],
  [
    "Phase 3",
    "Walk from “Phase 3”. The first Yes gives the total dice for the Hunt Box (rule 41).",
  ],
  [
    "Phase 4",
    "Roll the remaining Queller dice. Eyes go to the Hunt Box. Walk from “Phase 4”.",
  ],
  [
    "Phase 5",
    "You act first. Each time Queller is eligible to take an action, walk from the “Phase 5” ellipse of its current strategy. Alternate until both sides have no dice.",
  ],
  [
    "Battles",
    "Walk the Battle flowchart from “Battle” for the first combat round and from “Battle (next round)” for each later round.",
  ],
  ["Phase 6", "Victory check."],
];
