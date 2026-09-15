// Scripted scenarios for the behaviour fixed in version 52. Exit 1 on any failure.
const fakeWindow = require("./load.js")();
const engine = fakeWindow.QB,
  FLOW = fakeWindow.QB_FLOW,
  NODE = fakeWindow.QB_NODE,
  {
    DIE_STATE,
    PROMPT,
    STRATEGY,
    PHASE,
    CARD,
    DIE_REQUIREMENT,
    FP_STANCE,
    WALK_RESULT,
    TRAIL,
  } = engine;
const RANDOM_PICK_TRIALS = 60; // enough draws to see both outcomes of a coin flip
let fails = 0,
  scenarioNumber = "";
const ok = (condition, message) => {
  const line = scenarioNumber + " " + message;
  if (!condition) {
    fails++;
    console.log("FAIL", line);
  } else console.log("ok  ", line);
};
const die = (face, status) => ({
  kind: engine.DIE_KIND.ACTION,
  face,
  status: status || DIE_STATE.AVAIL,
});
// The answer a scenario gives when none of its rules match: No to every question, an empty battle form, "done" otherwise.
function defaultAnswer(prompt) {
  if (engine.YES_NO_PROMPTS.includes(prompt.type)) return false;
  return prompt.type === PROMPT.BATTLE_FORM
    ? { nazLead: 0, figures: {} }
    : "done";
}
// A scenario's rules: [pattern, answer] answers every prompt whose text matches; byType(type, answer) answers every prompt of one type.
// An answer may be a function of the prompt.
const byType = (type, answer) => ({
  test: (prompt) => prompt.type === type,
  answer,
});
function ruleAnswer(prompt, rules) {
  for (const rule of rules) {
    const [test, answer] = Array.isArray(rule)
      ? [(candidate) => rule[0].test(candidate.text || ""), rule[1]]
      : [rule.test, rule.answer];
    if (test(prompt))
      return typeof answer === "function" ? answer(prompt) : answer;
  }
  return undefined;
}
// Answer prompts by the rules until the walk finishes; returns the prompts seen.
function driveWalk(state, rules, maxPrompts = 80) {
  let guard = 0;
  const seen = [];
  while (state.walk && !state.walk.done && guard++ < maxPrompts) {
    const prompt = state.walk.prompt;
    seen.push(prompt);
    let answer = ruleAnswer(prompt, rules);
    if (answer === undefined) answer = defaultAnswer(prompt);
    engine.answer(state, answer);
  }
  return seen;
}
// A game at Phase 5 with the given settings and strategy; both hands start empty so a scenario deals exactly the cards it needs.
function phase5State(settings, strategy = STRATEGY.CORRUPTION) {
  const state = engine.newState(settings);
  state.strategy = strategy;
  state.phase = PHASE.P5;
  state.cards.hand = [];
  state.cards.factionHand = [];
  return state;
}
// Run fn with extra edges put at the front of a page's edge list, then put the list back.
function withTemporaryEdges(edges, extra, fn) {
  const saved = edges.slice();
  edges.unshift(...extra);
  try {
    fn();
  } finally {
    edges.length = 0;
    edges.push(...saved);
  }
}
const lastTrailText = (state) =>
  state.walk.trail[state.walk.trail.length - 1].text;
const noUsableDie = (state) =>
  !state.dice.pool.some(
    (pooledDie) =>
      pooledDie.status === DIE_STATE.RESERVED ||
      pooledDie.status === DIE_STATE.AVAIL,
  );

function reservedMusterDieIsUsedOrSpent() {
  const reservedAndHuntState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  reservedAndHuntState.board.nations.isengard = 0;
  reservedAndHuntState.dice.pool = [
    die("Muster", DIE_STATE.RESERVED),
    die("Eye", DIE_STATE.HUNT),
  ];
  reservedAndHuntState.minionReserved = true;
  engine.startPhase(reservedAndHuntState, PHASE.P5);
  driveWalk(reservedAndHuntState, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/action/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  ok(
    noUsableDie(reservedAndHuntState) && reservedAndHuntState.walk.done,
    "set-aside die spent when Muster 2 finds no action (" +
      reservedAndHuntState.walk.result +
      ")",
  );
  const reservedOnlyState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  reservedOnlyState.board.nations.isengard = 0;
  reservedOnlyState.dice.pool = [die("Muster", DIE_STATE.RESERVED)];
  reservedOnlyState.minionReserved = true;
  engine.startPhase(reservedOnlyState, PHASE.P5);
  driveWalk(reservedOnlyState, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
  ]);
  ok(
    reservedOnlyState.walk.result === WALK_RESULT.ACTION &&
      reservedOnlyState.dice.pool[0].status === DIE_STATE.USED &&
      reservedOnlyState.walk.trail.some(
        (entry) =>
          entry.kind === TRAIL.QUESTION &&
          /Will of the West/.test(entry.text) &&
          entry.auto &&
          entry.answer === "No",
      ),
    "Will-of-the-West check auto-answered No for a die already set aside; minion mustered",
  );
  ok(
    reservedOnlyState.board.chars.saruman === true,
    "(6.3) muster action updated the tracker (Saruman)",
  );
}
function twoReservedDiceBothUsed() {
  const twoReservedState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  twoReservedState.board.nations.isengard = 0;
  twoReservedState.dice.pool = [
    die("Muster", DIE_STATE.RESERVED),
    die("Army/Muster", DIE_STATE.RESERVED),
  ];
  twoReservedState.minionReserved = true;
  for (let i = 0; i < 3; i++) {
    engine.startPhase(twoReservedState, PHASE.P5);
    driveWalk(twoReservedState, [
      [/Will of the West/, true],
      [/^Pass/, "no"],
    ]);
  }
  ok(
    noUsableDie(twoReservedState),
    "two set-aside dice both consumed within three walks",
  );
}
// dice off: the cached "has a Muster die" answer is dropped when the die is set aside
function musterDieAskedAgainAfterReserve() {
  const diceOffState = phase5State(
    { dice: false, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  diceOffState.board.nations.isengard = 0;
  engine.startPhase(diceOffState, PHASE.P5);
  const seen = driveWalk(diceOffState, [
    [/Does Queller have a Muster die/, true],
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/threat\b.*muster/, false],
  ]);
  const asks = seen.filter(
    (prompt) => prompt?.type === PROMPT.DIE_CHECK && /Muster/.test(prompt.text),
  ).length;
  ok(asks >= 2, "Muster die asked again after the reserve (" + asks + " asks)");
}
// dice on, tracker off: no ring without one in the minimal tracker; one ring used once
function ringUsedOnceOnlyWhenHeld() {
  const stateWithEventAndMusterDice = () => {
    const state = phase5State({
      dice: true,
      cards: false,
      tracker: false,
      wome: false,
    });
    state.dice.pool = [die("Event"), die("Muster")];
    return state;
  };
  const ringRules = [
    [/under \*threat\*/, true],
    [/adjacent to \*threat\*/, true],
  ];
  const noRingState = stateWithEventAndMusterDice();
  noRingState.board.rings = 0;
  engine.startPhase(noRingState, PHASE.P5);
  driveWalk(noRingState, ringRules);
  ok(
    !noRingState.ringUsedThisTurn &&
      !noRingState.log.some((entry) => /Elven Ring/.test(entry.text)),
    "no ring used when the Shadow holds none",
  );
  const oneRingState = stateWithEventAndMusterDice();
  oneRingState.board.rings = 1;
  engine.startPhase(oneRingState, PHASE.P5);
  driveWalk(oneRingState, ringRules);
  ok(
    oneRingState.ringUsedThisTurn &&
      oneRingState.board.rings === 0 &&
      oneRingState.dice.pool.some(
        (pooledDie) => pooledDie.face === "Character",
      ),
    "one ring used, count decremented",
  );
}
function militaryPhase5PlaysRevealedCardAndPalantirDraws() {
  const militaryState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  militaryState.cards.hand = ["sa017", "sa002"];
  militaryState.cards.decks.S = ["sa019"];
  militaryState.board.fs.revealed = true;
  militaryState.cards.table.push(CARD.PALANTIR);
  militaryState.board.chars.saruman = true;
  militaryState.dice.pool = [die("Event"), die("Army")]; // no Character die → "Play card using event die"
  engine.startPhase(militaryState, PHASE.P5);
  const seen = driveWalk(militaryState, [byType(PROMPT.CONFIRM, true)]);
  const playCardPrompt = seen.find(
    (prompt) => prompt?.type === PROMPT.PLAY_CARD,
  );
  ok(
    playCardPrompt?.card === "sa017",
    "playcard prompt raised for Lure of the Ring",
  );
  ok(
    !militaryState.cards.hand.includes("sa017") &&
      militaryState.cards.discards.C.includes("sa017"),
    "card left the hand",
  );
  ok(
    militaryState.cards.hand.includes("sa019"),
    "Palantír drew a Strategy card after the Event die play",
  );
  ok(
    militaryState.dice.pool.find((pooledDie) => pooledDie.face === "Event")
      .status === DIE_STATE.USED,
    "Event die spent",
  );
}
function balrogOnTableOfferedAsDurinsBane() {
  const balrogState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  balrogState.cards.table = [CARD.BALROG];
  balrogState.cards.hand = ["sa002"];
  engine.startBattle(balrogState, 1);
  const seen = driveWalk(balrogState, [
    byType(PROMPT.BATTLE_FORM, { nazLead: 0, figures: {}, nearMoria: true }),
    byType(PROMPT.CONFIRM, true),
    [/Shadow army attacking/, true],
    [/sortie/, false],
    [/Witch King/, false],
    [/laying siege/, true],
  ]);
  const playCardPrompt = seen.find(
    (prompt) => prompt?.type === PROMPT.PLAY_CARD,
  );
  ok(
    playCardPrompt?.card === CARD.BALROG && playCardPrompt.combat,
    "Durin's Bane chosen from the table",
  );
  ok(
    !balrogState.cards.table.includes(CARD.BALROG) &&
      balrogState.cards.discards.C.includes(CARD.BALROG),
    "Balrog discarded from the table after combat use",
  );
}
// "Bring faction into play" and "Mustered Witch King" update the tracker
function actionsUpdateTheTracker() {
  const corsairsState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  corsairsState.cards.factionHand = ["sa_Faction01"];
  corsairsState.walk = null;
  engine.startWalk(corsairsState, "FA", "Recruit Faction", {
    die: DIE_REQUIREMENT.FACTION_RECRUIT,
  });
  driveWalk(corsairsState, [[/eligible/, true]]);
  ok(
    corsairsState.board.factions.corsairs === true,
    'Corsairs ticked after "Bring faction into play"',
  );
  const witchKingState = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  witchKingState.walk = null;
  engine.startWalk(witchKingState, "CH", "Character 3 / Muster Witch King", {
    die: DIE_REQUIREMENT.MUSTER,
  });
  driveWalk(witchKingState, [[/Mustered Witch King/, true]]);
  ok(
    witchKingState.board.chars.witchKing === true,
    'Witch King ticked after "Mustered Witch King"',
  );
  const hillmenState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  hillmenState.cards.factionHand = ["sa_Faction06"];
  hillmenState.walk = null;
  engine.startWalk(hillmenState, "FA", "Play Faction Event", {
    die: DIE_REQUIREMENT.FACTION_PLAY,
  });
  driveWalk(hillmenState, [byType(PROMPT.CONFIRM, true)]);
  ok(
    hillmenState.board.factions.dunlendings === true,
    "Wild Hillmen brought the Dunlendings into play",
  );
}
function lidlessEyeMovesDiceNotItsOwn() {
  const lidlessEyeState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.CORRUPTION,
  );
  lidlessEyeState.cards.hand = ["sa043"];
  lidlessEyeState.dice.pool = [
    die("Character"),
    die("Army"),
    die("Muster"),
    die("Event"),
    die("Character"),
  ];
  lidlessEyeState.walk = null;
  engine.startWalk(lidlessEyeState, "EV", "Event", {
    die: DIE_REQUIREMENT.EVENT,
    dieIndex: 3,
  });
  driveWalk(lidlessEyeState, [byType(PROMPT.CONFIRM, true)]);
  const huntDice = lidlessEyeState.dice.pool.filter(
    (pooledDie) => pooledDie.status === DIE_STATE.HUNT,
  );
  const eventDie = lidlessEyeState.dice.pool[3];
  ok(
    huntDice.length === 2 &&
      lidlessEyeState.dice.hunt === 2 &&
      huntDice.every((pooledDie) => pooledDie.face === "Eye"),
    "the two non-preferred dice changed to Eye and placed in the Hunt box",
  );
  ok(
    eventDie.status === DIE_STATE.USED,
    "the Event die that played the card was spent, not changed",
  );
  ok(
    lidlessEyeState.dice.pool.filter(
      (pooledDie) =>
        pooledDie.face === "Character" && pooledDie.status === DIE_STATE.AVAIL,
    ).length === 2,
    "preferred (Character) dice left alone while non-preferred ones existed",
  );
  const singleDieState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  singleDieState.cards.hand = ["sa043"];
  singleDieState.dice.pool = [die("Event")];
  singleDieState.walk = { dieIndex: 0 };
  ok(
    engine.precondition(singleDieState, "sa043") === false,
    "Lidless Eye unplayable when the only unused die is the one that would play it",
  );
  singleDieState.dice.pool.push(die("Army"));
  ok(
    engine.precondition(singleDieState, "sa043") === true,
    "…and playable once another unused die exists",
  );
}
function rule34CapsHuntAllocations() {
  const oneCompanionState = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  oneCompanionState.board.fs.companions = 1;
  oneCompanionState.dice.pool = [
    die(null, DIE_STATE.POOL),
    die(null, DIE_STATE.POOL),
    die(null, DIE_STATE.POOL),
  ];
  ok(
    engine.assignHunt(oneCompanionState, 2) === 1 &&
      oneCompanionState.dice.hunt === 1,
    '"Assign 2 dice" capped at 1 for one Companion',
  );
  oneCompanionState.board.fs.companions = 0;
  ok(
    engine.huntCap(oneCompanionState) === 1,
    "cap is at least 1 with no Companions",
  );
}
function tableTriggersDiscardOrAsk() {
  const tableState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  tableState.cards.table = [
    CARD.WORMTONGUE,
    CARD.PALANTIR,
    CARD.THREATS_AND_PROMISES,
    CARD.FLOCKS_OF_CREBAIN,
  ];
  tableState.board.chars.saruman = true;
  let asks = engine.tableTriggers(tableState, {
    key: "nations.rohan",
    from: FP_STANCE.PASSIVE,
    to: FP_STANCE.ACTIVE,
  });
  ok(
    !tableState.cards.table.includes(CARD.WORMTONGUE) && asks.length === 0,
    "Wormtongue discarded when Rohan activates",
  );
  ok(
    !tableState.cards.table.includes(CARD.THREATS_AND_PROMISES),
    "Threats and Promises discarded on a passive→active advance",
  );
  tableState.cards.table.push(CARD.THREATS_AND_PROMISES);
  asks = engine.tableTriggers(tableState, {
    key: "nations.gondor",
    from: FP_STANCE.ACTIVE,
    to: FP_STANCE.WAR,
  });
  ok(
    tableState.cards.table.includes(CARD.THREATS_AND_PROMISES) &&
      asks.length === 1 &&
      asks[0].card === CARD.THREATS_AND_PROMISES,
    "Threats and Promises asked about on active→war",
  );
  engine.tableTriggers(tableState, {
    key: "chars.saruman",
    from: true,
    to: false,
  });
  ok(
    !tableState.cards.table.includes(CARD.PALANTIR),
    "Palantír discarded when Saruman is eliminated",
  );
  tableState.board.fs.revealed = true;
  tableState.board.fs.inFPSettlement = true;
  asks = engine.tableTriggers(tableState, {
    key: "fs.revealed",
    from: false,
    to: true,
  });
  ok(
    asks.length === 1 && asks[0].card === CARD.FLOCKS_OF_CREBAIN,
    "Flocks of Crebain asked about when revealed in a Free Peoples settlement",
  );
}
// rule 19: Call to Battle cards ignore initiative
function callToBattleCardsIgnoreInitiative() {
  const callToBattleState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  callToBattleState.board.factions.corsairs = true;
  const seen = new Set();
  for (let i = 0; i < RANDOM_PICK_TRIALS; i++) {
    const picked = engine.applyPriority(
      callToBattleState,
      ["sa_battle01", "sa_battle02"],
      NODE.extra(FLOW.BA.nodes.atkPri).items,
    );
    seen.add(picked.chosen);
  }
  ok(
    seen.size === 2,
    "two Corsairs Call to Battle cards chosen at random, not by initiative",
  );
  const picked = engine.applyPriority(
    callToBattleState,
    ["sa017", "sa002"],
    ["Ascending order of initiative on Character cards"],
  );
  ok(
    ["sa017", "sa002"].includes(picked.chosen) &&
      picked.steps.length === 1 &&
      /Tie between 2 cards/.test(picked.steps[0]),
    '"on Character cards" ranks Character cards only; the Strategy card is kept alongside so the pick is a rule-3 tie',
  );
}
// battleOpen is reset each turn (7.4); the run guard ends a walk that never reaches a prompt (7.3)
function battleOpenResetAndRunGuard() {
  const turnState = phase5State({
    dice: false,
    cards: false,
    tracker: false,
    wome: false,
  });
  turnState.battleOpen = true;
  engine.nextTurn(turnState);
  ok(turnState.battleOpen === false, "battleOpen cleared by nextTurn");
  const cycleState = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  // an artificial cycle through a note box
  withTemporaryEdges(
    FLOW.C14.edges,
    [
      ["p4", "title"],
      ["title", "title"],
    ],
    () => engine.startPhase(cycleState, PHASE.P4),
  );
  ok(
    cycleState.walk?.done &&
      cycleState.walk.result === WALK_RESULT.NO_ACTION &&
      /did not finish/.test(lastTrailText(cycleState)),
    "run() ends a walk that never reaches a prompt instead of leaving it in limbo",
  );
}
// JSON with every object's keys sorted, so two objects compare equal whatever the order their keys were added in.
const canonical = (value) =>
  JSON.stringify(value, (key, field) =>
    field && typeof field === "object" && !Array.isArray(field)
      ? Object.fromEntries(Object.entries(field).sort())
      : field,
  );
// The field names a version-59 save used.
function downgradeToVersion59(save) {
  const rename = (object, from, to) => {
    object[to] = object[from];
    delete object[from];
  };
  for (const pooledDie of save.dice.pool) {
    rename(pooledDie, "kind", "k");
    rename(pooledDie, "status", "st");
  }
  rename(save.walk, "dieIndex", "dieObj");
  rename(save.walk, "reservedDieIndex", "reserveDieObj");
  for (const frame of save.walk.stack) rename(frame, "dieIndex", "dieObj");
  rename(save, "situational", "situ");
  for (const entry of save.log) rename(entry, "text", "t");
  save.appVersion = 59;
  return save;
}
// A version-59 save (dice {k, st}, walk dieObj/reserveDieObj, situ, log {t}) with an open die question migrates to the
// current shape and plays on; an open choice prompt's options {v, l} become {value, label}.
function migrateUpgradesVersion59Save() {
  const state = phase5State(
    { dice: false, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  state.dice.pool = [die("Muster", DIE_STATE.RESERVED), die("Army")];
  state.minionReserved = true;
  state.situational = { mtSiege: true };
  engine.startPhase(state, PHASE.P5);
  for (
    let guard = 0;
    state.walk?.prompt &&
    state.walk.prompt.type !== PROMPT.DIE_CHECK &&
    guard < 40;
    guard++
  )
    engine.answer(state, true);
  ok(
    state.walk?.prompt?.type === PROMPT.DIE_CHECK,
    "the walk reached a die question to save mid-way",
  );
  const before = canonical(state);
  const upgraded = engine.migrate(
    downgradeToVersion59(JSON.parse(JSON.stringify(state))),
  );
  upgraded.appVersion = state.appVersion;
  ok(
    canonical(upgraded) === before,
    "a version-59 save migrates back to the current shape",
  );
  engine.answer(upgraded, true);
  ok(
    upgraded.walk && (upgraded.walk.done || upgraded.walk.prompt),
    "the migrated walk answers on to the next prompt (" +
      (upgraded.walk.prompt?.type || upgraded.walk.result) +
      ")",
  );
  const choice = engine.migrate({
    settings: {},
    board: { nations: {} },
    walk: {
      dieObj: 1,
      stack: [{ dieObj: 2 }],
      prompt: {
        type: PROMPT.CHOICE,
        options: [{ v: "Isengard", l: "Isengard" }],
      },
    },
  });
  ok(
    choice.walk.dieIndex === 1 &&
      choice.walk.stack[0].dieIndex === 2 &&
      choice.walk.prompt.options[0].value === "Isengard" &&
      choice.walk.prompt.options[0].label === "Isengard",
    "an open choice prompt's options and the stack frames are migrated",
  );
}
// The scenarios, with the section of the change log each one guards.
const SCENARIOS = [
  ["7.1", reservedMusterDieIsUsedOrSpent],
  ["7.1", twoReservedDiceBothUsed],
  ["7.2", musterDieAskedAgainAfterReserve],
  ["ring", ringUsedOnceOnlyWhenHeld],
  ["6.1", militaryPhase5PlaysRevealedCardAndPalantirDraws],
  ["6.2", balrogOnTableOfferedAsDurinsBane],
  ["6.3", actionsUpdateTheTracker],
  ["6.4", lidlessEyeMovesDiceNotItsOwn],
  ["6.5", rule34CapsHuntAllocations],
  ["6.6", tableTriggersDiscardOrAsk],
  ["6.7", callToBattleCardsIgnoreInitiative],
  ["7.3/7.4", battleOpenResetAndRunGuard],
  ["v60", migrateUpgradesVersion59Save],
];
function main() {
  for (const [number, scenario] of SCENARIOS) {
    scenarioNumber = number;
    scenario();
  }
  console.log(fails ? fails + " failure(s)" : "all scenarios passed");
  process.exit(fails ? 1 : 0);
}
main();
