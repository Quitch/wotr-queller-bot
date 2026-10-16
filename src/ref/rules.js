// The numbered rules the flowcharts refer to: [[section, [[number, text], ...]], ...].
// Reference text from "Queller Bot for War of the Ring" v3.3, draft of 2026-10-15 (Quitch, CC BY-NC 4.0). Data only; ui/ and
// modals/ render it.
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
        "Queller must not do an action that makes it lose. Queller must not do an action that misses an immediate win. An action makes Queller lose when it gives the Free Peoples a one-action win that they did not have before: for example, Queller empties a Shadow City or Stronghold that a Free Peoples’ Army can then capture with one move, and the capture would give the Free Peoples 4 Victory points.",
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
        "Queller must not make a move that creates a *threat*, unless the move decreases the *distance* to that *threat*. “Creates a *threat*” means: a Shadow Stronghold that was not *under threat* becomes *under threat* because of the move. If a split Army prevents the *threat*, split the Army. The part that moves must keep enough *value* for the action.",
      ],
      [
        5,
        "A besieging Army is *adjacent* to the *garrison* inside the Stronghold, and the *garrison* is *adjacent* to the besieging Army. The besieging Army is also *adjacent* to the surrounding regions.",
      ],
      [
        6,
        "When an Army moves out of the Fellowship region, leave one Nazgûl, one Regular and one faction figure behind. Do this only when all of these are true: dice are in the Hunt Box; the Progress counter puts the Fellowship outside Mordor; the Army that moves still meets the move condition. Do not apply this rule to an attack.",
      ],
      [
        7,
        "A rule that the *distance* to the closest *target* must not increase does not prevent the closest *target* from changing.",
      ],
      [8, "Move faction figures with their Armies."],
      [
        9,
        "For an Army die, evaluate each decision and priority with both moves available. The two moves must be by two different Armies: no figure moves twice in one action (game rule). If two moves by two different Armies together meet a condition, the condition is true. When one move is used, walk the Army page again from the same start point with one move available. The Army that already moved is not a candidate.",
      ],
      [
        10,
        "When more than one Stronghold is *under threat*, respond in this order: the Stronghold that *the threat* besieges; then the Stronghold with the largest difference between the *value* of *the threat* and the *value* of its *garrison*; then the Stronghold closest to a *mobile* Army; then rule 3. When one Stronghold has more than one *threat*, respond to the *threat* with the highest *value* first. In the *threat* column, a Nazgûl or minion that moves alone counts for “Move can increase the value of the garrison of the Stronghold under threat” only when Queller has a Character die. With no Character die, the answer is No.",
      ],
      [
        11,
        "For “Move nearest Army towards exposed”, use the Army that the glossary (*exposed*) gives, and move one unit. Use an Army die. If Queller has none, use an Army/Muster die. If it has neither, use a Character die with an Army that contains a Nazgûl or a minion.",
      ],
      [
        12,
        "A besieged *target* stays the closest *target* of its besieging Army (see *target*). The besieger assaults through “Mobile Army can move or attack towards closest target” (Army 4, or Army 3 in the fallback chain), through the first decision of the Character page and, on the Military strategy, through “Mobile Army adjacent to target or an Army which is blocking the route to target”. Each assault is one action and one combat round, unless Queller downgrades an Elite. A besieged Shadow *garrison* sorties through the same boxes only when it is *mobile* at its sortie *value* (see *blocking* and *mobile*).",
      ],
    ],
  ],
  [
    "Battles",
    [
      [
        13,
        "Remove Shadow units to satisfy a card until the next removal would make the Army *passive*.",
      ],
      [
        14,
        "You must select and play your Combat card before Queller selects its card.",
      ],
      [15, "Only *aggressive* Armies can attack."],
    ],
  ],
  [
    "Cards",
    [
      [
        16,
        "For card play, use the decision page that matches the card. Examples: Phase 3 hunt allocation for Eyes; the Army page for attacks; the Event page or Faction page to choose discards.",
      ],
      [
        17,
        "When a card gives Queller a choice that no flowchart covers, use the priority list for the die that matches the card (rule 16). If nothing fits, select the option that best fits the current strategy. If that is still not clear, apply rule 3.",
      ],
      [
        18,
        "If a card tells Queller to remove enemy Armies from a region, use the Army page to select the region. Treat the Shadow Army in that region as *mobile*.",
      ],
      [
        19,
        "If a card in play prevents a Queller action, Queller does what is necessary to remove that card from play. Queller does this only when it tries to do the blocked action. If one action cannot remove the card, the blocked action is not possible (rule 36).",
      ],
      [20, "Play cards “in play” at the first opportunity."],
      [
        21,
        "Do not play a card when any of these is true: a paragraph (a separately described effect) is not eligible; a paragraph has no effect; the card does the same thing as the die that Queller uses; the card requires a *passive* Army to attack.",
      ],
      [22, "For “Fly, You Fools”, roll a die. Queller loses on a 1."],
      [
        23,
        "Move the Fellowship back one space, to the location that makes the hunt easiest and progress hardest. If two locations are equal, apply rule 3.",
      ],
      [
        24,
        "For a Call to Battle card, ignore initiative. Select one valid card at random.",
      ],
      [
        25,
        "If the Character or Strategy Event deck that a flowchart names is empty, draw from the other of those two decks. If both are empty, the draw is not possible (rule 36). A Faction Event deck is reshuffled when it runs out (WoME rules). This rule does not change the Phase 1 draw: with one deck empty, Queller draws one card only (game rule).",
      ],
    ],
  ],
  [
    "Characters",
    [
      [26, "In this document, “Nazgûl” does not include the Witch-king."],
      [27, "Do not use a character ability that has no effect."],
    ],
  ],
  [
    "Dice",
    [
      [
        28,
        "Use the die that has the same name as the flowchart, unless the flowchart says otherwise. A grey box with a die in brackets is an exception: follow that page, but use the die that is named.",
      ],
      [
        29,
        "If a card or effect forces Queller to discard dice, discard at random from the dice that do not show a *preferred* result (see the glossary).",
      ],
      [
        30,
        "If Queller has no Army die or no Muster die for an action, use an Army/Muster die. If it needs an Army die and has no Army/Muster die, use a Muster die as an Army die with Messenger of the Dark Tower, if possible (the Mouth of Sauron is in play; once per turn). On the Army page, an Army/Muster die tries Muster 3 before the last-resort move (“Using an Army/Muster die”).",
      ],
      [
        31,
        "To play a Faction Event card when Queller has no die with the card’s icon, use a Wild result of a Faction die.",
      ],
    ],
  ],
  [
    "Muster",
    [
      [
        32,
        "If the specified unit type is not available, use the next type in this sequence: Elite, Regular, Nazgûl, Elite. Apply this to the *primary*. After the unit type changes, select the *primary* again, because the eligible regions can change: Nazgûl are recruited only in a Sauron Stronghold (game rule). If the *secondary* unit type is not available, use the other of Regular and Nazgûl, never an Elite. If the *primary* becomes an Elite, Muster nothing at the *secondary*.",
      ],
      [
        33,
        "If Isengard is the source of the *primary* and Saruman is in play, use Voice of Saruman. If Orthanc is *under threat*, upgrade. If Orthanc is not *under threat* and 3 Regulars are available, Muster with the ability. If neither ability is possible, Muster normally.",
      ],
      [
        34,
        "A Muster die that “Save muster for use as last die” sets aside is used only to recruit the minion through Muster 2: at “Use Muster die set aside for minion” at the end of Phase 5, or when it is the only Queller die left. Queller cannot use the die for anything else, and rule 39 does not discard it.",
      ],
    ],
  ],
  [
    "Flowcharts",
    [
      [
        35,
        "Walk a flowchart from the green ellipse named for the phase, the combat round, or the point that a grey box or a rule names. Each time Queller is eligible to take an action, and each combat round, walk again from that ellipse. A walk does not continue from the point where the last walk stopped.",
      ],
      [
        36,
        "If Queller cannot do a red action, follow the arrow out of the ellipse. If there is no arrow, return to the grey box that sent you to the page (on the Phase 5 flowchart or on another die page). Follow the arrow out of that box. On the Battle page, “Retreat into Stronghold” and “Retreat” have an arrow to follow when Queller cannot do them.",
      ],
      [
        37,
        "Apply a priority list as a sequence of filters. Apply criterion 1. Keep only the options that satisfy it. If no option satisfies it, skip it and keep all options. If one option remains, select it. If more than one option remains, apply the next criterion to those options. If more than one option remains after the last criterion, apply rule 3.",
      ],
      [
        38,
        "A criterion that compares a quantity (for example “highest value”) keeps each option that is equal best. A criterion that starts “Doesn’t …” keeps the options that avoid the thing described.",
      ],
      [
        39,
        "At “Discard unplayable die”, set aside one die that Queller could not use, selected at random. Do not select the Muster die set aside for a minion (rule 34). That is the Queller action.",
      ],
    ],
  ],
  [
    "Hunt",
    [
      [40, "Queller uses each Hunt re-roll that the game rules permit."],
      [
        41,
        "If the flowchart gives a hunt allocation below the game minimum, place the minimum. If the flowchart gives more than the game maximum, place the maximum.",
      ],
      [
        42,
        "“Fellowship” on a flowchart means the Fellowship of the Ring (game rules). Its current location is the region that contains the Ring-bearers figure: the last known position (game rules). Use this region for each decision about where the Fellowship is, what is *adjacent* to it and its *distance*. Use the Progress counter only where a box names it (“Progress”, “figure plus Progress”). Where the box needs a region, count the Progress counter forward from the figure along the shortest route to Mount Doom.",
      ],
    ],
  ],
  [
    "Elven Rings",
    [
      [
        43,
        "When a bold condition on a Phase 5 flowchart is true, and Queller has no die of the type that the step needs, use an Elven Ring. Change one other Queller die to the required result (rule 46 names the result for each bold box). Use an Elven Ring only when the action that the die page reaches is possible with the new die (rule 1). An Army/Muster die counts as an Army die or a Muster die. Select the die to change at random from the dice that do not show a *preferred* result. If all dice show a *preferred* result, select at random from all dice.",
      ],
      [
        44,
        "At “Phase 5 (use an Elven Ring for any condition possible)”, walk the Phase 5 flowchart again from the top. Use an Elven Ring at the first decision, bold or not, where a different die result lets Queller act. Do this only when Queller holds an Elven Ring and has not used one this turn (game rule: one Elven Ring per player per turn).",
      ],
      [
        45,
        "After Queller has used an Elven Ring in a turn, read each bold condition as a normal condition for the rest of that turn.",
      ],
      [
        46,
        "The table gives the die that an Elven Ring creates for each bold box.\n• Shadow under *threat* or Free Peoples *exposed* → Character, Army or Muster. The die of the first step below the box that is possible: Character for “Attack using Character die” and “Move using Character die”; Army for “Attack using Army die”, “Army” and “Can move towards exposed”; Muster for “Muster”.\n• Character cards > 0 and ANY condition true: Fellowship on the Mordor Track; Fellowship revealed → Character or Event. Character if a Character card is *playable*, otherwise Event.\n• Witch-king is in play and not in a *mobile* Army → Character. Only if he can join or create a *mobile* Army.\n• Conditions to muster a minion met → Muster. Not when the Muster page would set the die aside.\n• The attack boxes: Corruption “Fellowship on the Mordor Track” and “Target would win the game”; Military “Mobile Army adjacent to target or an Army which is blocking the route to target” → Character or Army. Character if the adjacent *mobile* Army contains a Nazgûl or a minion, otherwise Army.",
      ],
    ],
  ],
  [
    "Strategy",
    [
      [
        47,
        "Queller changes strategy only where a flowchart says so. The comparison is strict: if Corruption points and Shadow Victory points are equal, Queller does not change strategy.",
      ],
      [
        48,
        "A change of strategy applies immediately. Complete the current turn on the flowcharts of the new strategy. Enter at the green ellipse that is named. Use the Phase 5 flowchart of the new strategy for each later action.",
      ],
    ],
  ],
  [
    "Nazgûl",
    [
      [
        49,
        "Place the Nazgûl one at a time against the placement priority list. Test each criterion against the board with the Nazgûl already placed. A criterion counts only while it is still true: “One in region which contains the Fellowship” is met by one Nazgûl, and “Leadership value less than number of Army units and 5” is no longer true for an Army that reaches that limit.",
      ],
      [
        50,
        "Rule 4 applies to Nazgûl placement. When you gather the Nazgûl, a Nazgûl whose removal would put its Stronghold *under threat* stays where it is.",
      ],
    ],
  ],
  [
    "Free Peoples player",
    [
      [
        51,
        "You can correct a Queller action that came from a misread flowchart. You can do this only if no dice were rolled and no cards were drawn or revealed after the action.",
      ],
    ],
  ],
];
