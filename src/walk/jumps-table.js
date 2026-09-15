// The grey boxes: JUMPS maps a box's text to the page, start point and die it jumps to (or the kind of jump it is);
// the die names the prompts use; the priority lists whose items are card criteria.
import { DIE_REQUIREMENT, STRATEGY } from "../engine/index.js";
import { normalizeText } from "./graph.js";

// The priority-list boxes whose items are card criteria (check.js verifies the engine understands every item).
export const CARD_CRITERIA_NODES = [
  "C14.disc14",
  "C14.disc18",
  "C14.discF",
  "M14.disc",
  "M14.discF",
  "EV.prefPri",
  "EV.anyPri",
  "EV.discPri",
  "FA.playPri",
  "FA.discPri",
  "BA.sortiePri",
  "BA.wkPri",
  "BA.atkPri",
  "BA.defPri",
];

const JUMPS = [
  [/^Army$/, { page: "AR", start: "Army", die: DIE_REQUIREMENT.ARMY }],
  [/^Army 2$/, { page: "AR", start: "Army 2", die: DIE_REQUIREMENT.ARMY }],
  [/^Army 3$/, { page: "AR", start: "Army 3", die: DIE_REQUIREMENT.ARMY }],
  [/^Army 4$/, { page: "AR", start: "Army 4", die: DIE_REQUIREMENT.ARMY }],
  [
    /^Army 4 \((use )?character die\)$/,
    { page: "AR", start: "Army 4", die: DIE_REQUIREMENT.CHARACTER },
  ],
  [/^Muster$/, { page: "MU", start: "Muster", die: DIE_REQUIREMENT.MUSTER }],
  [
    /^Muster 2$/,
    { page: "MU", start: "Muster 2", die: DIE_REQUIREMENT.MUSTER },
  ],
  [
    /^Muster 3 \/ Muster Event card$/,
    {
      page: "MU",
      start: "Muster 3/Muster Event card",
      die: DIE_REQUIREMENT.MUSTER,
    },
  ],
  [
    /^Character$/,
    { page: "CH", start: "Character", die: DIE_REQUIREMENT.CHARACTER },
  ],
  [
    /^Character 2$/,
    { page: "CH", start: "Character 2", die: DIE_REQUIREMENT.CHARACTER },
  ],
  [
    /^Character 3 \/ Muster Witch King$/,
    {
      page: "CH",
      start: "Character 3 / Muster Witch King",
      die: DIE_REQUIREMENT.CHAR_OR_MUSTER,
    },
  ],
  [/^Event$/, { page: "EV", start: "Event", die: DIE_REQUIREMENT.EVENT }],
  [
    /^Event \(use character die\)$/,
    { page: "EV", start: "Event", die: DIE_REQUIREMENT.CHARACTER },
  ],
  [/^Event 2$/, { page: "EV", start: "Event 2", die: DIE_REQUIREMENT.EVENT }],
  [
    /^Event 2 \(use character die\)$/,
    { page: "EV", start: "Event 2", die: DIE_REQUIREMENT.CHARACTER },
  ],
  [
    /^Recruit Faction$/,
    {
      page: "FA",
      start: "Recruit Faction",
      die: DIE_REQUIREMENT.FACTION_RECRUIT,
      wome: true,
    },
  ],
  [
    /^Play Faction Event$/,
    {
      page: "FA",
      start: "Play Faction Event",
      die: DIE_REQUIREMENT.FACTION_PLAY,
      wome: true,
    },
  ],
  [
    /^Draw Faction Event$/,
    {
      page: "FA",
      start: "Draw Faction Event",
      die: DIE_REQUIREMENT.FACTION_DRAW,
      wome: true,
    },
  ],
  [/^Phase 5 - continue/, { kind: "return" }],
  [/^Phase 5 \(use a ring/, { kind: "ringAny" }],
  [/^Save muster/, { kind: "reserve" }],
  [
    /^Switch to military/,
    {
      kind: "switch",
      strategy: STRATEGY.MILITARY,
      endWalk: "Phase 3",
      text: "Queller switches to the military strategy. Continue at “Phase 3” on the Military flowchart.",
    },
  ],
  [
    /^Switch to Corruption/,
    {
      kind: "switch",
      strategy: STRATEGY.CORRUPTION,
      page: "C14",
      start: "From Military Strategy",
    },
  ],
  [/Strategy Phase 5$/, { kind: "endPhase4" }],
  [/^Battle \(next round\)$/, { kind: "battleNext" }],
];
export const DIE_REQUIREMENT_NAME = {
  [DIE_REQUIREMENT.ARMY]: "Army",
  [DIE_REQUIREMENT.MUSTER]: "Muster",
  [DIE_REQUIREMENT.CHARACTER]: "Character",
  [DIE_REQUIREMENT.EVENT]: "Event",
  [DIE_REQUIREMENT.CHAR_OR_MUSTER]: "Character or Muster",
  [DIE_REQUIREMENT.FACTION_RECRUIT]: "Faction (Recruit)",
  [DIE_REQUIREMENT.FACTION_PLAY]: "Faction (Play)",
  [DIE_REQUIREMENT.FACTION_DRAW]: "Faction (Draw)",
};
export function dieWithArticle(requirement) {
  const name = DIE_REQUIREMENT_NAME[requirement] || requirement;
  return (/^[AEIOU]/.test(name) ? "an " : "a ") + name;
}
export function jumpSpec(boxText) {
  const label = normalizeText(boxText);
  for (const [pattern, spec] of JUMPS) if (pattern.test(label)) return spec;
  return null;
}
