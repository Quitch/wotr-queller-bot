// The numbered rules the flowcharts refer to: [[section, [[number, text], ...]], ...].
// Reference text from "Queller Bot for War of the Ring" v3.3 (Quitch, CC BY-NC 4.0). Data only; ui/ and modals/ render it.
// In any text, *term* marks a glossary term (rendered as a tooltip link) and "\n•" starts a bullet line.
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
