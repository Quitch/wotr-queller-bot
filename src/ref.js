// Reference text shown in the Help, Rules and glossary modals — the Queller Learning Guide's terms, its numbered
// rules, the rulings and the turn sequence. Data only; ui.js and modals.js render it.
//   GLOSSARY          {term: definition}; GLOSSARY_ALIASES maps other spellings to a term
//   RULES             [[section, [[number, text], ...]], ...] — the rule numbers the flowcharts refer to
//   RULINGS           [[question, answer], ...]
//   TURN              [[phase, text], ...]
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

export const RULES = [
  [
    "Actions",
    [
      [
        1,
        "The game rules have priority over Queller actions. Example: Queller does not do an action when it does not have the correct die.",
      ],
      [
        2,
        "Queller must not do an action that makes it lose. Queller must not do an action that misses an immediate win.",
      ],
      [
        3,
        "When Queller has two or more equally valid options, roll a die to select one.",
      ],
    ],
  ],
  [
    "Armies",
    [
      [
        4,
        "Queller must not make a move that creates a *threat*, unless the move decreases the *distance* to that *threat*. “Creates a *threat*” means: a Shadow Stronghold that was not under *threat* becomes under *threat* because of the move. If a split army prevents the *threat*, split the army. The part that moves must keep enough *value* for the action.",
      ],
      [
        5,
        "A besieging army is adjacent to the *garrison* and to the Stronghold. It is also adjacent to the surrounding regions.",
      ],
      [
        6,
        "When an army moves out of the *Fellowship region*, leave one Nazgûl, one regular and one faction figure behind. Do this only when all of these are true: Eyes are in the Hunt box; the Progress counter puts the Fellowship outside Mordor; the army that moves still meets the move condition. Do not apply this rule to an attack.",
      ],
      [
        7,
        "A rule that the *distance* to the closest *target* must not increase does not prevent the closest *target* from changing.",
      ],
      [8, "Move faction figures with their armies."],
      [
        9,
        "For an Army die, evaluate each decision and priority with both moves available. If two moves together meet a condition, the condition is true. When one move is used, walk the Army page again for the second move with one move available.",
      ],
    ],
  ],
  [
    "Battles",
    [
      [
        10,
        "Remove Shadow units to satisfy a card until the next removal would make the army *passive*.",
      ],
      [
        11,
        "You must select and play your combat card before Queller selects its card.",
      ],
    ],
  ],
  [
    "Cards",
    [
      [
        12,
        "For card play, use the decision page that matches the card. Examples: Phase 3 hunt allocation for Eyes; the Army page for attacks; the Event page or Faction page to choose discards.",
      ],
      [13, "Only *aggressive* armies can attack."],
      [
        14,
        "If a card tells Queller to remove enemy armies from a region, use the Army page to select the region. Treat the Shadow army as *mobile*.",
      ],
      [
        15,
        "If a card in play prevents a Queller action, Queller does what is necessary to remove that card from play. Queller does this only when it tries to do the blocked action.",
      ],
      [16, "Play cards “in play” at the first opportunity."],
      [
        17,
        "Do not play a card when any of these is true: a paragraph (a separately described effect) is not eligible; a paragraph has no effect; the card does the same thing as the die that Queller uses; the card requires a *passive* army to attack.",
      ],
      [18, "For “Fly, You Fools”, roll a die. Queller loses on a 1."],
      [
        19,
        "For a Call to Battle card, ignore initiative. Select one valid card at random.",
      ],
    ],
  ],
  [
    "Characters",
    [
      [20, "In this document, “Nazgûl” does not include the Witch King."],
      [21, "Do not use a character ability that has no effect."],
    ],
  ],
  [
    "Dice",
    [
      [
        22,
        "Use the die that has the same name as the flowchart, unless the flowchart says otherwise. A grey box with a die in brackets is an exception: follow that page, but use the die that is named.",
      ],
      [
        23,
        "If a card or effect forces Queller to discard dice, discard at random from the dice that do not show a *preferred* result.",
      ],
      [
        24,
        "If Queller has no Army die or no Muster die for an action, use an Army/Muster die. If it has no Army/Muster die, use Messenger of the Dark Tower if possible.",
      ],
      [
        25,
        "Use the Wild result of a Faction die when the required Shadow Action die is not available.",
      ],
    ],
  ],
  [
    "Muster",
    [
      [
        26,
        "If the specified unit type is not available, use the next type in this sequence: elite, regular, Nazgûl, elite.",
      ],
      [
        27,
        "If Isengard is the source of the *primary* and Saruman is in play, use Voice of Saruman. If Orthanc is under *threat*, upgrade. If Orthanc is not under *threat* and 3 regulars are available, muster with the ability. If neither ability is possible, muster normally.",
      ],
    ],
  ],
  [
    "Flowcharts",
    [
      [
        28,
        "Walk a flowchart from the green ellipse named for the phase, the combat round, or the point that a grey box or a rule names. Each time Queller is eligible to take an action, and each combat round, walk again from that ellipse. A walk does not continue from the point where the last walk stopped.",
      ],
      [
        29,
        "If Queller cannot do a red action, follow the arrow out of the ellipse. If there is no arrow, return to the grey box on the Phase 5 flowchart that sent you to the page. Follow the arrow out of that box.",
      ],
      [
        30,
        "Apply a priority list as a sequence of filters. Apply criterion 1. Keep only the options that satisfy it. If no option satisfies it, skip it and keep all options. If one option remains, select it. If more than one option remains, apply the next criterion to those options. If more than one option remains after the last criterion, apply rule 3.",
      ],
      [
        31,
        "A criterion that compares a quantity (for example “highest value”) keeps each option that is equal best. A criterion that starts “Doesn’t …” keeps the options that avoid the thing described.",
      ],
      [
        32,
        "At “Discard unplayable die”, set aside one die that Queller could not use, selected at random. That is the Queller action.",
      ],
    ],
  ],
  [
    "Hunt",
    [
      [33, "Queller uses each Hunt re-roll that the game rules permit."],
      [
        34,
        "If the flowchart gives a hunt allocation below the game minimum, place the minimum. If the flowchart gives more than the game maximum, place the maximum.",
      ],
      [
        35,
        "“Fellowship” on a flowchart always means the Fellowship figure and the Progress counter. Queller never uses the hidden position of the Fellowship. You must not let the hidden position change a Queller choice.",
      ],
    ],
  ],
  [
    "Rings",
    [
      [
        36,
        "When a bold condition on a Phase 5 flowchart is true, and Queller has no die of the type that the step needs, use an Elven Ring. Change one other Queller die to the required result. An Army/Muster die counts as an Army die or a Muster die. Select the die to change at random from the dice that do not show a *preferred* result. If all dice show a *preferred* result, select at random from all dice.",
      ],
      [
        37,
        "At “Phase 5 (use a ring for any condition possible)”, walk the Phase 5 flowchart again from the top. Use a ring at the first decision, bold or not, where a different die result lets Queller act.",
      ],
      [
        38,
        "After Queller has used a ring in a turn, read each bold condition as a normal condition for the rest of that turn.",
      ],
    ],
  ],
  [
    "Strategy",
    [
      [
        39,
        "Queller changes strategy only where a flowchart says so. The comparison is strict: if Corruption points and Shadow Victory points are equal, Queller does not change strategy.",
      ],
      [
        40,
        "A change of strategy applies immediately. Complete the current turn on the flowcharts of the new strategy. Enter at the green ellipse that is named. Use the Phase 5 flowchart of the new strategy for each later action.",
      ],
    ],
  ],
  [
    "Nazgûl",
    [
      [
        41,
        "Place the Nazgûl one at a time against the placement priority list. A criterion that an earlier Nazgûl already satisfies attracts another Nazgûl only if the placement can still be improved.",
      ],
    ],
  ],
  [
    "Free Peoples player",
    [
      [
        42,
        "Make each die roll for Queller (rule 3) before you look at anything else. Never roll again.",
      ],
      [
        43,
        "You can correct a Queller action that came from a misread flowchart. You can do this only if no dice were rolled and no cards were drawn or revealed after the action.",
      ],
    ],
  ],
];

export const RULINGS = [
  [
    "How does Queller act with the card Cruel Weather?",
    "Move the Fellowship back one space, to the location that makes the hunt easiest and progress hardest. If two locations are equal, apply rule 3.",
  ],
  [
    "Queller captures a Free Peoples’ Stronghold. Is it a Shadow Stronghold for threat or for the Phase 3 hunt check?",
    "No. “Shadow Stronghold” is the rulebook term (page 11) for the Strongholds printed in the Shadow colours. Queller considers only those for *threat* and for “Shortest Fellowship route leads via a Shadow stronghold”.",
  ],
  [
    "What does “maximum possible leadership” mean?",
    "The maximum that the game rules permit. Example: an army of 3 units cannot have leadership higher than 3.",
  ],
  [
    "A card gives Queller a choice that no flowchart covers. What does Queller do?",
    "Use the priority list for the die that matches the card (rule 12). If nothing fits, select the option that best fits the current strategy. If that is still not clear, apply rule 3.",
  ],
  [
    "When does Queller pass?",
    "Only when a flowchart reaches “Pass” and the game rules permit a pass. If Queller cannot pass, apply rule 29.",
  ],
  [
    "A Muster die is set aside for a minion. When is it used?",
    "When Queller reaches “Use Muster die set aside for minion” at the end of Phase 5, or when it is the only Queller die left. Recruit the minion through Muster 2. Queller cannot use the die for anything else.",
  ],
];

export const TURN = [
  [
    "Phase 1",
    "Recover the Queller dice. Draw one Character and one Strategy Event card (and one Faction Event card with WoME). Walk the Phases 1–4 flowchart from “Phase 1”.",
  ],
  [
    "Phase 2",
    "Declare or hide your Fellowship. Corruption strategy: walk from “Phase 2”.",
  ],
  [
    "Phase 3",
    "Walk from “Phase 3”. The first Yes gives the total dice for the Hunt box (rule 34).",
  ],
  [
    "Phase 4",
    "Roll the remaining Queller dice. Eyes go to the Hunt box. Walk from “Phase 4”.",
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
