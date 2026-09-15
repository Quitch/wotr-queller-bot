// The Queller Learning Guide's terms: GLOSSARY is {term: definition}; GLOSSARY_ALIASES maps other spellings to a term.
// Reference text from "Queller Bot for War of the Ring" v3.3 (Quitch, CC BY-NC 4.0). Data only; ui/ and modals/ render it.
// In any text, *term* marks a glossary term (rendered as a tooltip link) and "\n•" starts a bullet line.
export const GLOSSARY = {
  adjacent:
    "Two regions are adjacent when an army can move directly from one to the other. A Shadow army that besieges a Stronghold is adjacent to the *garrison* inside the Stronghold. The *garrison* is adjacent to the besieging army (rule 5).",
  aggressive:
    "An army is *aggressive* against an enemy army when one of these conditions is true:\n• The army is from an active nation, and its *value* is equal to or more than the enemy army’s *value* (with the enemy’s defensive bonuses).\n• The army has 10 units and contains the Witch King or 5 leadership.",
  blocking:
    "An enemy army that is on a *mobile* army’s shortest route to its closest *target*. An attack on a blocking army counts as a move towards the *target*.",
  distance:
    "The number of regions between an army and a destination, counted along the shortest route that an army can take. Ignore enemy armies. Do not cross impassable borders. “Within 2 regions” means a *distance* of 2 or less.",
  exposed:
    "A *target* is *exposed* when both of these conditions are true:\n• No enemy army is in the *target* region.\n• No enemy army is on the shortest route from a Shadow army to the *target*.",
  "fellowship region":
    "The region that contains the Fellowship figure on the map. Use it with the Progress counter (rule 35).",
  "full hand":
    "The maximum number of cards that the game rules let Queller hold. With WoME, Queller has two hands: Event cards and Faction Event cards.",
  garrison:
    "An army inside a Stronghold, or an army in a Stronghold region. An army that besieges a Stronghold is not a *garrison*.",
  mobile:
    "An army is *mobile* when it can move towards its closest *target* without creating *threat*, and one of these conditions is true:\n• It is *aggressive* against a *target* in the same nation as its closest *target*, and against each enemy army on the shortest route to that *target*. Compare each army separately.\n• Its move would change a *passive* siege at its closest *target* into an *aggressive* siege.\n• It has 10 units.\nTo check: Step 1: find the army’s closest *target*. Step 2: can it move one region closer without creating *threat* (rule 4)? If no, it is not *mobile*. If yes, test the three conditions. Do not count Saruman in its *value*.",
  passive:
    "An army that is not *aggressive*. A *passive* nation shows Passive on the Political Track. A *passive* siege is a siege by a *passive* army.",
  playable:
    "A card is *playable* when Queller can use each paragraph of it legally now, and rule 17 does not exclude it.",
  preferred:
    "Corruption strategy: a card with a character symbol. Military strategy: a card with an army symbol or a muster symbol.",
  primary:
    "The muster region closest to the *target* or army that the flowchart names. A region is eligible only if the game rules let Queller muster there now.",
  secondary:
    "The muster region closest to the *primary*. If the *primary* and the *secondary* are the same region, muster both units there. If no *secondary* exists, muster only the *primary* unit.",
  "stacking limit": "Ten Army units in one region (game rule).",
  target:
    "Only the items below are *targets*. When two *targets* are at the same *distance*, the item higher in this list has priority:\n1. Conquered Shadow Stronghold\n2. Free Peoples’ army that creates *threat* (ignore for *exposed*)\n3. Stronghold not under siege by an *aggressive* Shadow army: nation at war; active nation; passive nation\n4. Unconquered Free Peoples’ City: nation at war; active nation\n5. Lowest *value* *garrison*\nTo check: Find the closest *target* for each Shadow army separately. Measure the *distance* to each candidate. Keep the nearest. If two are at the same *distance*, use the list order. If they are the same type, apply rule 3. Read nation status from the Political Track.",
  threat:
    "A region is a *threat* when one of these conditions is true:\n• The region contains a Free Peoples’ army from an active nation. The army is not a *garrison*. The army is 1 or 2 regions from an unconquered Shadow Stronghold. The army’s *value* is more than the *value* of that Stronghold’s Shadow *garrison*.\n• The Orthanc *garrison* with Saruman has less than 4 hits of Shadow units, and one of these is true: with WoME, the Ent faction is in play; without WoME, Gandalf the White is in play and a Companion is in Fangorn. The *threat* is the region that contains the Ents or the Companion.\nTo check: Say “the Stronghold is under threat” and “the enemy army is the threat”. For each unconquered Shadow Stronghold, list the Free Peoples’ armies within two regions that are from an active nation and are not *garrisons*. Compare the *value* of each such army as an attacker (no defensive bonus) with the *value* of the Shadow *garrison* as a defender (with the ×1.5 Stronghold bonus). If the attacker is higher, the Stronghold is under threat. An empty Stronghold has *value* 0.",
  value:
    "The *value* of an army is the total of these points:\n• +1 for each hit the army can take (rules page 30)\n• +1 for each combat die, including Captain of the West (maximum 5)\n• +1 for each point of leadership (maximum 5, and not more than the number of Army units)\n• +1 for each Captain of the West\n• +1 when the army defends in a Fortification or City region\n• ×1.5 (round down) when the army defends in a Stronghold. *Mobile* and *threat* always use this, even when there is no siege. Only the hits of the five strongest units in the region count.\n• ×0.5 (round down) for a sortie\n• Do not count Saruman when you test whether an army is *mobile*",
};
export const GLOSSARY_ALIASES = {
  threatened: "threat",
  targets: "target",
  "exposed target": "exposed",
  aggressively: "aggressive",
};
