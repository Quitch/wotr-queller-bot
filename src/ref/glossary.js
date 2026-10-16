// The Queller glossary: GLOSSARY is {term: definition}; GLOSSARY_ALIASES maps other spellings to a term.
// Reference text from "Queller Bot for War of the Ring" v3.3, draft of 2026-10-15 (Quitch, CC BY-NC 4.0). Data only; ui/ and
// modals/ render it.
// In any text, *term* marks a glossary term (rendered as a tooltip link) and "\n•" starts a bullet line.
export const GLOSSARY = {
  adjacent:
    "Two regions are *adjacent* when an Army can move directly from one to the other. For a siege, see rule 5.",
  aggressive:
    "An Army is *aggressive* against an enemy Army when one of these conditions is true:\n• Its *value* is equal to or more than the enemy Army’s *value* (with the enemy’s defensive bonuses).\n• The Army has 10 units and contains the Witch-king or 5 Leadership.",
  blocking:
    "An enemy Army that is on a *mobile* Army’s shortest route to its closest *target*. For a besieged Shadow *garrison*, the besieging Army is *blocking*. An attack on a *blocking* Army counts as a move towards the *target*.",
  distance:
    "The number of regions between an Army and a destination, counted along the shortest route that an Army can take. Ignore enemy Armies. Do not cross impassable borders. “Within 2 regions” means a *distance* of 2 or less.",
  exposed:
    "A *target* is *exposed* when both of these conditions are true:\n• No enemy Army is in the *target* region.\n• The nearest Shadow Army that can legally move to the *target* has at least one shortest route to it with no enemy Army on it.\nTo check: measure from the nearest Shadow Army that the game rules let make the move (its Nation At War, or a route inside its own Nation’s borders). If two routes are equally short and one is clear, the *target* is *exposed*. Move one unit. Rule 11 gives the die.",
  "full hand":
    "The maximum number of cards that the game rules let Queller hold. With WoME, Queller has two hands: Event cards and Faction Event cards.",
  garrison:
    "An Army inside a Stronghold, or an Army in a Stronghold region. An Army that besieges a Stronghold is not a *garrison*.",
  mobile:
    "An Army is *mobile* when it can move or attack towards its closest *target* without creating *threat*, and one of these conditions is true:\n• It is *aggressive* against a *target* in the same Nation as its closest *target*, and against each enemy Army on the shortest route to that same-Nation *target*. Compare each Army separately.\n• Its move would change a *passive* siege at its closest *target* into an *aggressive* siege.\n• It has 10 units.\nTo check: Step 1: find the Army’s closest *target*. Step 2: can it move one region closer to that *target* without creating *threat* (rule 4), or attack the *target*, a *blocking* Army or, when it besieges the *target*, the *garrison*? An attack counts as a move towards the *target*. If neither is possible, it is not *mobile*. If yes, test the three conditions. For a besieged *garrison*, use the sortie *value*.",
  passive:
    "An Army that is not *aggressive*. A *passive* Nation shows Passive on the Political Track. A *passive* siege is a siege by a *passive* Army.",
  playable:
    "A card is *playable* when Queller can use each paragraph of it legally now, and rule 21 does not exclude it.",
  preferred:
    "A *preferred* card: Corruption strategy, a card with a Character symbol; Military strategy, a card with an Army symbol or a Muster symbol. A *preferred* die result: Corruption strategy, Character; Military strategy, Army, Muster and Army/Muster.",
  primary:
    "The Muster region closest to the *target* or Army that the flowchart names. A region is eligible only if the game rules let Queller Muster there now.",
  secondary:
    "The Muster region closest to the *primary*, in a different Settlement. The *secondary* receives a unit only when the *primary* unit is a Regular or a Nazgûl. A Muster die that places an Elite places nothing else (game rule). If no eligible *secondary* exists, Muster only the *primary* unit. These limits apply to a Muster die. A card that musters follows its own text (game rule): when the card places its units in one region, Muster them all there.",
  "stacking limit": "Ten Army units in one region (game rule).",
  target:
    "Only the items below are *targets*. When two *targets* are at the same *distance*, the item higher in this list has priority:\n1. Conquered Shadow Stronghold\n2. Free Peoples’ Army that creates *threat* (ignore for *exposed*)\n3. Stronghold not under siege by an *aggressive* Shadow Army (a Stronghold under such a siege stays the *target* of the besieging Army only): Nation At War; Active Nation; *Passive* Nation\n4. Unconquered Free Peoples’ City: Nation At War; Active Nation\n5. Lowest-*value* Free Peoples’ *garrison*, only when no *target* of type 1–4 exists\nTo check: Find the closest *target* for each Shadow Army separately. Measure the *distance* to each candidate. Keep the nearest. If two are at the same *distance*, use the list order. If they are the same type, apply rule 3. Read Nation status from the Political Track. A Stronghold under siege by an *aggressive* Shadow Army is the closest *target* of that Army; no other Army treats it, or its *garrison*, as a *target* while a *target* of type 1–4 exists.",
  threat:
    "A region is a *threat* when one of these conditions is true:\n• The region contains a Free Peoples’ Army from a Nation At War, or from an active Nation one step from At War. The Army is not a *garrison*. The Army is 1 or 2 regions from an unconquered Shadow Stronghold. The Army’s *value* is more than the *value* of that Stronghold’s Shadow *garrison*.\n• The Orthanc *garrison* with Saruman has less than 4 hits of Shadow units, and one of these is true: with WoME, the Ent faction is in play; without WoME, Gandalf the White is in play and a Companion is in Fangorn. The *threat* is the region that contains the Ents or the Companion.\nTo check: Say “the Stronghold is *under threat*” and “the enemy Army is *the threat*”. For each unconquered Shadow Stronghold, list the Free Peoples’ Armies within two regions that are from a Nation At War, or from an active Nation one step from At War, and are not *garrisons*. Compare the *value* of each such Army as an attacker (no defensive bonus) with the *value* of the Shadow *garrison* as a defender (with the ×1.5 Stronghold bonus). If the attacker is higher, the Stronghold is *under threat*. An empty Stronghold has *value* 0.",
  value:
    "The *value* of an Army is the total of these points:\n• +1 for each hit the Army can take (rules page 30)\n• +1 for each combat die (maximum 5)\n• +1 for each point of Leadership (maximum 5, and not more than the number of Army units)\n• +1 when the Army defends in a Fortification or City region\n• ×1.5 (round down) when the Army defends in a Stronghold. *Mobile* and *threat* always use this, even when there is no siege. Only the hits of the five strongest units in the region count.\n• ×0.5 (round down) for a sortie\n• Do not count Saruman when you test whether an Army is *mobile*\n• For an attack (*aggressive*, *mobile*), count only the units of Nations At War, plus Leaders (Leadership not more than the number of those units). Units of Nations not At War form the rear-guard and do not count. An Army with no unit of a Nation At War cannot attack.",
};
export const GLOSSARY_ALIASES = {
  threatened: "threat",
  "under threat": "threat",
  "the threat": "threat",
  targets: "target",
  "exposed target": "exposed",
  aggressively: "aggressive",
};
