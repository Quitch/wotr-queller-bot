// Rulings: [[question, answer], ...].
// Reference text from "Queller Bot for War of the Ring" v3.3 (Quitch, CC BY-NC 4.0). Data only; ui/ and modals/ render it.
// In any text, *term* marks a glossary term (rendered as a tooltip link) and "\n•" starts a bullet line.
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
