// Scripted scenarios for the behaviour fixed in version 52. Exit 1 on any failure.
const fakeWindow = require("./load.js")();
const engine = fakeWindow.QB,
  DIE_STATE = engine.DIE_STATE;
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.log("FAIL", message);
  } else console.log("ok  ", message);
};
const die = (face, status) => ({
  k: engine.DIE_KIND.ACTION,
  face,
  st: status || DIE_STATE.AVAIL,
});
// The answer a scenario gives when none of its rules match: No to every question, an empty battle form, "done" otherwise.
function defaultAnswer(prompt) {
  if (["yesno", "situ", "confirm", "diecheck", "ring"].includes(prompt.type))
    return false;
  return prompt.type === "battleForm" ? { nazLead: 0, figures: {} } : "done";
}
// The scenario's answer to a prompt: the first rule whose pattern matches the prompt's text, type or card (a value, or a function of the prompt).
function ruleAnswer(prompt, rules) {
  for (const [pattern, answer] of rules) {
    if (
      pattern.test(
        (prompt.text || "") + " " + prompt.type + " " + (prompt.card || ""),
      )
    )
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
function phase5State(settings, strategy = engine.STRATEGY.CORRUPTION) {
  const state = engine.newState(settings);
  state.strategy = strategy;
  state.phase = engine.PHASE.P5;
  state.cards.hand = [];
  state.cards.factionHand = [];
  return state;
}

// 7.1 the set-aside Muster die is used or spent, never re-reserved
{
  const reservedAndHuntState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  reservedAndHuntState.board.nations.isengard = 0;
  reservedAndHuntState.dice.pool = [
    die("Muster", DIE_STATE.RESERVED),
    die("Eye", DIE_STATE.HUNT),
  ];
  reservedAndHuntState.minionReserved = true;
  engine.startPhase(reservedAndHuntState, engine.PHASE.P5);
  driveWalk(reservedAndHuntState, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/action/, "no"],
  ]);
  ok(
    !reservedAndHuntState.dice.pool.some(
      (pooledDie) =>
        pooledDie.st === DIE_STATE.RESERVED || pooledDie.st === DIE_STATE.AVAIL,
    ) && reservedAndHuntState.walk.done,
    "7.1 set-aside die spent when Muster 2 finds no action (" +
      reservedAndHuntState.walk.result +
      ")",
  );
  const reservedOnlyState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  reservedOnlyState.board.nations.isengard = 0;
  reservedOnlyState.dice.pool = [die("Muster", DIE_STATE.RESERVED)];
  reservedOnlyState.minionReserved = true;
  engine.startPhase(reservedOnlyState, engine.PHASE.P5);
  driveWalk(reservedOnlyState, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
  ]);
  ok(
    reservedOnlyState.walk.result === "action" &&
      reservedOnlyState.dice.pool[0].st === DIE_STATE.USED &&
      reservedOnlyState.walk.trail.some(
        (entry) =>
          entry.kind === "q" &&
          /Will of the West/.test(entry.text) &&
          entry.auto &&
          entry.answer === "No",
      ),
    "7.1 Will-of-the-West check auto-answered No for a die already set aside; minion mustered",
  );
  ok(
    reservedOnlyState.board.chars.saruman === true,
    "6.3 muster action updated the tracker (Saruman)",
  );
}
// two dice set aside in one walk are both used eventually
{
  const twoReservedState = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  twoReservedState.board.nations.isengard = 0;
  twoReservedState.dice.pool = [
    die("Muster", DIE_STATE.RESERVED),
    die("Army/Muster", DIE_STATE.RESERVED),
  ];
  twoReservedState.minionReserved = true;
  for (let i = 0; i < 3; i++) {
    engine.startPhase(twoReservedState, engine.PHASE.P5);
    driveWalk(twoReservedState, [
      [/Will of the West/, true],
      [/^Pass/, "no"],
    ]);
  }
  ok(
    !twoReservedState.dice.pool.some(
      (pooledDie) =>
        pooledDie.st === DIE_STATE.RESERVED || pooledDie.st === DIE_STATE.AVAIL,
    ),
    "7.1 two set-aside dice both consumed within three walks",
  );
}
// 7.2 dice off: the cached "has a Muster die" answer is dropped when the die is set aside
{
  const diceOffState = phase5State(
    { dice: false, cards: false, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  diceOffState.board.nations.isengard = 0;
  engine.startPhase(diceOffState, engine.PHASE.P5);
  const seen = driveWalk(diceOffState, [
    [/Does Queller have a Muster die/, true],
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/threat\b.*muster/, false],
  ]);
  const asks = seen.filter(
    (prompt) => prompt?.type === "diecheck" && /Muster/.test(prompt.text),
  ).length;
  ok(
    asks >= 2,
    "7.2 Muster die asked again after the reserve (" + asks + " asks)",
  );
}
// Ring: dice on, tracker off — no ring without one in the minimal tracker; one ring used once
{
  const stateWithEventAndMusterDice = () => {
    const noRingState = phase5State({
      dice: true,
      cards: false,
      tracker: false,
      wome: false,
    });
    noRingState.dice.pool = [die("Event"), die("Muster")];
    return noRingState;
  };
  const noRingState = stateWithEventAndMusterDice();
  noRingState.board.rings = 0;
  engine.startPhase(noRingState, engine.PHASE.P5);
  driveWalk(noRingState, [
    [/under \*threat\*/, true],
    [/adjacent to \*threat\*/, true],
  ]);
  ok(
    !noRingState.ringUsedThisTurn &&
      !noRingState.log.some((entry) => /Elven Ring/.test(entry.t)),
    "ring: no ring used when the Shadow holds none",
  );
  const oneRingState = stateWithEventAndMusterDice();
  oneRingState.board.rings = 1;
  engine.startPhase(oneRingState, engine.PHASE.P5);
  driveWalk(oneRingState, [
    [/under \*threat\*/, true],
    [/adjacent to \*threat\*/, true],
  ]);
  ok(
    oneRingState.ringUsedThisTurn &&
      oneRingState.board.rings === 0 &&
      oneRingState.dice.pool.some(
        (pooledDie) => pooledDie.face === "Character",
      ),
    "ring: one ring used, count decremented",
  );
}
// 6.1 Military Phase 5 plays the revealed card, Palantír draws
{
  const militaryState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  militaryState.cards.hand = ["sa017", "sa002"];
  militaryState.cards.decks.S = ["sa019"];
  militaryState.board.fs.revealed = true;
  militaryState.cards.table.push(engine.CARD.PALANTIR);
  militaryState.board.chars.saruman = true;
  militaryState.dice.pool = [die("Event"), die("Army")]; // no Character die → "Play card using event die"
  engine.startPhase(militaryState, engine.PHASE.P5);
  const seen = driveWalk(militaryState, [[/confirm/, true]]);
  const playCardPrompt = seen.find((prompt) => prompt?.type === "playcard");
  ok(
    playCardPrompt?.card === "sa017",
    "6.1 playcard prompt raised for Lure of the Ring",
  );
  ok(
    !militaryState.cards.hand.includes("sa017") &&
      militaryState.cards.discards.C.includes("sa017"),
    "6.1 card left the hand",
  );
  ok(
    militaryState.cards.hand.includes("sa019"),
    "6.1 Palantír drew a Strategy card after the Event die play",
  );
  ok(
    militaryState.dice.pool.find((pooledDie) => pooledDie.face === "Event")
      .st === DIE_STATE.USED,
    "6.1 Event die spent",
  );
}
// 6.2 Balrog on the table is offered as Durin's Bane
{
  const balrogState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    engine.STRATEGY.MILITARY,
  );
  balrogState.cards.table = [engine.CARD.BALROG];
  balrogState.cards.hand = ["sa002"];
  engine.startBattle(balrogState, 1);
  const seen = driveWalk(balrogState, [
    [/battleForm/, { nazLead: 0, figures: {}, nearMoria: true }],
    [/confirm/, true],
    [/Shadow army attacking/, true],
    [/sortie/, false],
    [/Witch King/, false],
    [/laying siege/, true],
  ]);
  const playCardPrompt = seen.find((prompt) => prompt?.type === "playcard");
  ok(
    playCardPrompt?.card === engine.CARD.BALROG && playCardPrompt.combat,
    "6.2 Durin's Bane chosen from the table",
  );
  ok(
    !balrogState.cards.table.includes(engine.CARD.BALROG) &&
      balrogState.cards.discards.C.includes(engine.CARD.BALROG),
    "6.2 Balrog discarded from the table after combat use",
  );
}
// 6.3 Bring faction into play / Mustered Witch King update the tracker
{
  const corsairsState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  corsairsState.cards.factionHand = ["sa_Faction01"];
  corsairsState.walk = null;
  engine.startWalk(corsairsState, "FA", "Recruit Faction", {
    die: engine.DIE_REQUIREMENT.FACTION_RECRUIT,
  });
  driveWalk(corsairsState, [[/eligible/, true]]);
  ok(
    corsairsState.board.factions.corsairs === true,
    '6.3 Corsairs ticked after "Bring faction into play"',
  );
  const witchKingState = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  witchKingState.walk = null;
  engine.startWalk(witchKingState, "CH", "Character 3 / Muster Witch King", {
    die: engine.DIE_REQUIREMENT.MUSTER,
  });
  driveWalk(witchKingState, [[/Mustered Witch King/, true]]);
  ok(
    witchKingState.board.chars.witchKing === true,
    '6.3 Witch King ticked after "Mustered Witch King"',
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
    die: engine.DIE_REQUIREMENT.FACTION_PLAY,
  });
  driveWalk(hillmenState, [[/confirm/, true]]);
  ok(
    hillmenState.board.factions.dunlendings === true,
    "6.3 Wild Hillmen brought the Dunlendings into play",
  );
}
// 6.4 The Lidless Eye moves dice to the Hunt box, never the die that played it
{
  const lidlessEyeState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    engine.STRATEGY.CORRUPTION,
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
    die: engine.DIE_REQUIREMENT.EVENT,
    dieObj: 3,
  });
  driveWalk(lidlessEyeState, [[/confirm/, true]]);
  const huntDice = lidlessEyeState.dice.pool.filter(
    (pooledDie) => pooledDie.st === DIE_STATE.HUNT,
  );
  const eventDie = lidlessEyeState.dice.pool[3];
  ok(
    huntDice.length === 2 &&
      lidlessEyeState.dice.hunt === 2 &&
      huntDice.every((pooledDie) => pooledDie.face === "Eye"),
    "6.4 the two non-preferred dice changed to Eye and placed in the Hunt box",
  );
  ok(
    eventDie.st === DIE_STATE.USED,
    "6.4 the Event die that played the card was spent, not changed",
  );
  ok(
    lidlessEyeState.dice.pool.filter(
      (pooledDie) =>
        pooledDie.face === "Character" && pooledDie.st === DIE_STATE.AVAIL,
    ).length === 2,
    "6.4 preferred (Character) dice left alone while non-preferred ones existed",
  );
  const singleDieState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  singleDieState.cards.hand = ["sa043"];
  singleDieState.dice.pool = [die("Event")];
  singleDieState.walk = { dieObj: 0 };
  ok(
    engine.precondition(singleDieState, "sa043") === false,
    "6.4 Lidless Eye unplayable when the only unused die is the one that would play it",
  );
  singleDieState.dice.pool.push(die("Army"));
  ok(
    engine.precondition(singleDieState, "sa043") === true,
    "6.4 …and playable once another unused die exists",
  );
}
// 6.5 rule 34 caps the fixed allocations
{
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
    '6.5 "Assign 2 dice" capped at 1 for one Companion',
  );
  oneCompanionState.board.fs.companions = 0;
  ok(
    engine.huntCap(oneCompanionState) === 1,
    "6.5 cap is at least 1 with no Companions",
  );
}
// 6.6 table triggers
{
  const tableState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  tableState.cards.table = [
    engine.CARD.WORMTONGUE,
    engine.CARD.PALANTIR,
    engine.CARD.THREATS_AND_PROMISES,
    engine.CARD.FLOCKS_OF_CREBAIN,
  ];
  tableState.board.chars.saruman = true;
  let asks = engine.tableTriggers(tableState, {
    key: "nations.rohan",
    from: engine.FP_STANCE.PASSIVE,
    to: engine.FP_STANCE.ACTIVE,
  });
  ok(
    !tableState.cards.table.includes(engine.CARD.WORMTONGUE) &&
      asks.length === 0,
    "6.6 Wormtongue discarded when Rohan activates",
  );
  ok(
    !tableState.cards.table.includes(engine.CARD.THREATS_AND_PROMISES),
    "6.6 Threats and Promises discarded on a passive→active advance",
  );
  tableState.cards.table.push(engine.CARD.THREATS_AND_PROMISES);
  asks = engine.tableTriggers(tableState, {
    key: "nations.gondor",
    from: engine.FP_STANCE.ACTIVE,
    to: engine.FP_STANCE.WAR,
  });
  ok(
    tableState.cards.table.includes(engine.CARD.THREATS_AND_PROMISES) &&
      asks.length === 1 &&
      asks[0].card === engine.CARD.THREATS_AND_PROMISES,
    "6.6 Threats and Promises asked about on active→war",
  );
  engine.tableTriggers(tableState, {
    key: "chars.saruman",
    from: true,
    to: false,
  });
  ok(
    !tableState.cards.table.includes(engine.CARD.PALANTIR),
    "6.6 Palantír discarded when Saruman is eliminated",
  );
  tableState.board.fs.revealed = true;
  tableState.board.fs.inFPSettlement = true;
  asks = engine.tableTriggers(tableState, {
    key: "fs.revealed",
    from: false,
    to: true,
  });
  ok(
    asks.length === 1 && asks[0].card === engine.CARD.FLOCKS_OF_CREBAIN,
    "6.6 Flocks of Crebain asked about when revealed in a Free Peoples settlement",
  );
}
// 6.7 rule 19: Call to Battle cards ignore initiative
{
  const callToBattleState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  callToBattleState.board.factions.corsairs = true;
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const picked = engine.applyPriority(
      callToBattleState,
      ["sa_battle01", "sa_battle02"],
      fakeWindow.QB_FLOW.BA.nodes.atkPri[6].items,
    );
    seen.add(picked.chosen);
  }
  ok(
    seen.size === 2,
    "6.7 two Corsairs Call to Battle cards chosen at random, not by initiative",
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
    '6.7 "on Character cards" ranks Character cards only; the Strategy card is kept alongside so the pick is a rule-3 tie',
  );
}
// 7.4 battleOpen reset each turn; 7.3 guard ends the walk
{
  const turnState = phase5State({
    dice: false,
    cards: false,
    tracker: false,
    wome: false,
  });
  turnState.battleOpen = true;
  engine.nextTurn(turnState);
  ok(turnState.battleOpen === false, "7.4 battleOpen cleared by nextTurn");
  const cycleState = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  const edges = fakeWindow.QB_FLOW.C14.edges;
  const saved = edges.slice();
  edges.unshift(["p4", "title"], ["title", "title"]); // an artificial cycle through a note box
  engine.startPhase(cycleState, engine.PHASE.P4);
  edges.length = 0;
  edges.push(...saved);
  ok(
    cycleState.walk?.done &&
      cycleState.walk.result === "noaction" &&
      /did not finish/.test(
        cycleState.walk.trail[cycleState.walk.trail.length - 1].text,
      ),
    "7.3 run() ends a walk that never reaches a prompt instead of leaving it in limbo",
  );
}
console.log(fails ? fails + " failure(s)" : "all scenarios passed");
process.exit(fails ? 1 : 0);
