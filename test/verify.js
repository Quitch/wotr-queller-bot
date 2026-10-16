// Scripted scenarios for the behaviour fixed in version 52. Exit 1 on any failure.
import { readFileSync } from "node:fs";
import * as fakeWindow from "./load.js";
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
    MINION_STATUS,
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
const factionDie = (face) => ({
  kind: engine.DIE_KIND.FACTION,
  face,
  status: DIE_STATE.AVAIL,
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
      ? [
          (candidate) =>
            rule[0].test(
              [candidate.text || "", ...(candidate.items || [])].join(" "),
            ),
          rule[1],
        ]
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
const lastLogText = (state) => state.log[state.log.length - 1].text;
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
    reservedOnlyState.board.chars.saruman === MINION_STATUS.IN_PLAY,
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
// Rule 34: the Army/Muster die held for "Attack using Army die" is the Muster die the Muster page sets aside for a
// minion; back on C5 the walk no longer holds it, so the move towards the target cannot spend it.
function reservedDieIsNotSpentAsArmyDie() {
  const rules = [
    [/^Move can create/, false],
    [/Will of the West/, true],
    [/^Shadow under/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*(threat|target)\*$/, true],
    [/^Attack using Army die$/, "no"],
    [/not under siege and in a Nation At War/, true],
    [/can move or attack towards closest/, true],
    [/^Does Queller have a Character die/, false],
    [/^Does Queller have/, true],
  ];
  const diceOn = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  diceOn.board.nations.isengard = 0;
  diceOn.dice.pool = [die("Army/Muster")];
  engine.startPhase(diceOn, PHASE.P5);
  driveWalk(diceOn, rules);
  ok(
    diceOn.dice.pool[0].status === DIE_STATE.RESERVED &&
      diceOn.minionReserved &&
      diceOn.walk.result !== WALK_RESULT.ACTION,
    "dice on: the die set aside for a minion is not spent as the Army die (" +
      diceOn.dice.pool[0].status +
      ", " +
      diceOn.walk.result +
      ")",
  );
  const diceOff = phase5State({
    dice: false,
    cards: false,
    tracker: true,
    wome: false,
  });
  diceOff.board.nations.isengard = 0;
  engine.startPhase(diceOff, PHASE.P5);
  const seen = driveWalk(diceOff, rules);
  const armyAsks = seen.filter(
    (prompt) =>
      prompt?.type === PROMPT.DIE_CHECK && /have an Army die/.test(prompt.text),
  ).length;
  ok(
    diceOff.minionReserved && armyAsks === 2,
    "dice off: after the Muster die is set aside, the Army die is asked about again (" +
      armyAsks +
      " asks)",
  );
  ok(
    diceOff.log.some((entry) => /^Queller used an Army die/.test(entry.text)),
    "dice off: the log says “an Army die”",
  );
  // Dice on, and a page between C5 and the Muster page also holds the die (its frame is added by hand: today only C5
  // and M5 jump to the Muster boxes that set a die aside). The player turns dice off after the Muster page returns.
  const toggled = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  toggled.board.nations.isengard = 0;
  toggled.dice.pool = [die("Army/Muster")];
  engine.startPhase(toggled, PHASE.P5);
  let guard = 0;
  while (
    !/Will of the West/.test(toggled.walk.prompt?.text || "") &&
    guard++ < 40
  ) {
    const prompt = toggled.walk.prompt;
    engine.answer(toggled, ruleAnswer(prompt, rules) ?? defaultAnswer(prompt));
  }
  toggled.walk.stack.push({
    page: "AR",
    node: "jMuster3",
    die: DIE_REQUIREMENT.ARMY,
    dieIndex: 0,
    dieViaMessenger: false,
    dieUsed: false,
  });
  engine.answer(toggled, true);
  toggled.settings.dice = false;
  const toggledSeen = driveWalk(toggled, [
    [/^Does Queller have an Army die/, false],
    ...rules,
  ]);
  ok(
    toggled.minionReserved &&
      toggledSeen.some((prompt) => /have an Army die/.test(prompt?.text)) &&
      !toggled.log.some((entry) =>
        /^Queller used an Army die/.test(entry.text),
      ),
    "dice turned off after the reserve: no page returned to still holds the die set aside",
  );
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
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
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
  militaryState.board.chars.saruman = MINION_STATUS.IN_PLAY;
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
    [/has retreated/, false],
    [/^Shadow Army attacking$/, true],
    [/sortie/, false],
    [/Witch-king/, false],
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
// "Bring faction into play" and "Mustered Witch-king" update the tracker
function actionsUpdateTheTracker() {
  const corsairsState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  corsairsState.cards.factionHand = ["sa_Faction01"];
  corsairsState.dice.pool = [factionDie("Recruit")];
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
  witchKingState.dice.pool = [die("Muster")];
  witchKingState.walk = null;
  engine.startWalk(witchKingState, "CH", "Character 3 / Muster Witch-king", {
    die: DIE_REQUIREMENT.MUSTER,
  });
  driveWalk(witchKingState, [[/Mustered Witch-king/, true]]);
  ok(
    witchKingState.board.chars.witchKing === MINION_STATUS.IN_PLAY,
    'Witch-king in play after "Mustered Witch-king"',
  );
}
// A WoME game at Phase 5 whose Faction hand holds only `id`, after the FA page has played it; `setUp` runs first.
function playFactionCard(id, setUp = () => {}) {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  state.cards.factionHand = [id];
  state.dice.pool = [factionDie("Play/Draw")];
  setUp(state);
  state.walk = null;
  engine.startWalk(state, "FA", "Play Faction Event", {
    die: DIE_REQUIREMENT.FACTION_PLAY,
  });
  driveWalk(state, [byType(PROMPT.CONFIRM, true)]);
  return state;
}
// WoME rules: a Faction Event card played on a Faction not in play never brings it into play; a card that recruits
// "or adds to the starting setup" puts its figures on the Faction card.
function recruitCardKeepsFactionOutOfPlay() {
  const hillmen = playFactionCard("sa_Faction06");
  ok(
    hillmen.board.factions.dunlendings === false &&
      hillmen.cards.discards.F.includes("sa_Faction06") &&
      hillmen.log.some((entry) =>
        /Dunlendings are not in play, so the recruited figures go on the Dunlendings Faction card/.test(
          entry.text,
        ),
      ),
    "Wild Hillmen leaves the Dunlendings out of play and puts the figures on the Faction card",
  );
  const fleet = playFactionCard("sa_Faction01", (state) => {
    state.board.factions.corsairs = true;
  });
  ok(
    fleet.board.factions.corsairs === true &&
      fleet.cards.discards.F.includes("sa_Faction01") &&
      !fleet.log.some((entry) => /Faction card/.test(entry.text)),
    "A Great Fleet with the Corsairs in play recruits on the board: no Faction-card note",
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
    huntDice.length === 3 &&
      lidlessEyeState.dice.hunt === 3 &&
      huntDice.every((pooledDie) => pooledDie.face === "Eye"),
    "three dice changed to Eye and placed in the Hunt box",
  );
  ok(
    eventDie.status === DIE_STATE.USED,
    "the Event die that played the card was spent, not changed",
  );
  ok(
    lidlessEyeState.dice.pool[1].status === DIE_STATE.HUNT &&
      lidlessEyeState.dice.pool[2].status === DIE_STATE.HUNT &&
      lidlessEyeState.dice.pool.filter(
        (pooledDie) =>
          pooledDie.face === "Character" &&
          pooledDie.status === DIE_STATE.AVAIL,
      ).length === 1,
    "both non-preferred dice taken, topped up with one preferred (Character) die",
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
// "Up to three": one non-preferred die does not cut the count to one (rule 29 orders the dice, it does not limit them).
function lidlessEyeTopsUpToThree() {
  const topUpState = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.CORRUPTION,
  );
  topUpState.dice.pool = [
    die("Character"),
    die("Character"),
    die("Character"),
    die("Army"),
  ];
  const chosen = engine.nonPreferredFirst(topUpState, topUpState.dice.pool, 3);
  ok(
    chosen.length === 3 && chosen[0].face === "Army",
    "[Character ×3, Army] gives three dice, the Army die first",
  );
  ok(
    engine.nonPreferredFirst(topUpState, topUpState.dice.pool, 1)[0].face ===
      "Army",
    "a count of one (the Elven Ring) still takes the non-preferred die",
  );
}
// The game minimum of 1 Hunt die (rulebook p.20) on the flowchart's 0-dice paths, asked of the player after turn 1.
function huntMinimumAskedOnZeroDicePaths() {
  const phase3State = (strategy, dice, turn = 2) => {
    const state = engine.newState({
      dice,
      cards: false,
      tracker: true,
      wome: false,
    });
    state.strategy = strategy;
    state.turn = turn;
    state.dice.pool = Array.from({ length: 7 }, () =>
      die(null, DIE_STATE.POOL),
    );
    engine.startPhase(state, PHASE.P3);
    return state;
  };
  const minimumQuestion = /take a die out of the Hunt Box/;
  const wasAsked = (prompts) =>
    prompts.some((prompt) => minimumQuestion.test(prompt.text));
  const rollsLogged = (state) =>
    state.log.filter((entry) => /for the hunt allocation/.test(entry.text))
      .length;
  const stepWhy = (state) =>
    state.walk.trail.find(
      (entry) => entry.kind === TRAIL.STEP && /^Roll a die/.test(entry.text),
    )?.why;
  const stepPrompt = (prompts) =>
    prompts.find(
      (prompt) =>
        prompt.type === PROMPT.STEP && /Hunt Box/.test(prompt.text || ""),
    )?.text;
  for (const [answer, hunt] of [
    [true, 1],
    [false, 0],
  ]) {
    const militaryState = phase3State(STRATEGY.MILITARY, true);
    const asked = driveWalk(militaryState, [[minimumQuestion, answer]]);
    ok(
      wasAsked(asked) && militaryState.dice.hunt === hunt,
      "Military “Assign 0 dice”, answered " +
        (answer ? "Yes" : "No") +
        ": " +
        hunt +
        " in the Hunt Box",
    );
  }
  const firstTurnState = phase3State(STRATEGY.MILITARY, true, 1);
  ok(
    !wasAsked(driveWalk(firstTurnState, [[minimumQuestion, true]])) &&
      firstTurnState.dice.hunt === 0,
    "turn 1 has no previous turn: not asked, 0 in the Hunt Box",
  );
  const realRandom = Math.random;
  try {
    for (const [roll, answer, hunt, why] of [
      [0, true, 1, "rolled 1 → 1 in the Hunt Box (the game minimum)"],
      [0, false, 0, "rolled 1 → 0 in the Hunt Box"],
      [0.9, false, 1, "rolled 6 → 1 in the Hunt Box"],
    ]) {
      Math.random = () => roll;
      const corruptionState = phase3State(STRATEGY.CORRUPTION, true);
      const asked = driveWalk(corruptionState, [[minimumQuestion, answer]]);
      ok(
        wasAsked(asked) === (roll === 0) &&
          corruptionState.dice.hunt === hunt &&
          rollsLogged(corruptionState) === 1 &&
          stepWhy(corruptionState) === why,
        "Corruption, dice on: " +
          why +
          (roll ? ", not asked" : "") +
          ", rolled once",
      );
    }
    // dice switched off while the question is open after the app's roll: the roll stands
    for (const [answer, text] of [
      [true, "Assign 1 die to the Hunt Box (rolled 1; the game minimum)."],
      [false, "Assign 0 dice to the Hunt Box (rolled 1)."],
    ]) {
      Math.random = () => 0;
      const toggledState = phase3State(STRATEGY.CORRUPTION, true);
      const asked = driveWalk(toggledState, [
        {
          test: (prompt) => minimumQuestion.test(prompt.text),
          answer: () => {
            toggledState.settings.dice = false;
            return answer;
          },
        },
      ]);
      ok(
        stepPrompt(asked) === text && rollsLogged(toggledState) === 1,
        "dice switched off after the roll, answered " +
          (answer ? "Yes" : "No") +
          ": “" +
          text +
          "”, no second roll",
      );
    }
    // dice switched on while the question is open before the player's roll: the app rolls once
    Math.random = () => 0;
    const switchedOnState = phase3State(STRATEGY.CORRUPTION, false);
    const switchedOnPrompts = driveWalk(switchedOnState, [
      {
        test: (prompt) => minimumQuestion.test(prompt.text),
        answer: () => {
          switchedOnState.settings.dice = true;
          return false;
        },
      },
    ]);
    ok(
      wasAsked(switchedOnPrompts) &&
        rollsLogged(switchedOnState) === 1 &&
        stepWhy(switchedOnState) === "rolled 1 → 0 in the Hunt Box",
      "dice switched on after the question, answered No: one roll, 0 in the Hunt Box",
    );
  } finally {
    Math.random = realRandom;
  }
  for (const strategy of [STRATEGY.MILITARY, STRATEGY.CORRUPTION]) {
    const diceOffState = phase3State(strategy, false);
    const asked = driveWalk(diceOffState, [[minimumQuestion, true]]);
    ok(
      stepPrompt(asked) === "Assign 1 die to the Hunt Box (the game minimum).",
      strategy + " with dice off, answered Yes: the player assigns 1 die",
    );
  }
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
  tableState.board.chars.saruman = MINION_STATUS.IN_PLAY;
  let asks = engine.tableTriggers(tableState, {
    key: "nations.rohan",
    from: FP_STANCE.PASSIVE,
    to: FP_STANCE.ACTIVE,
  });
  ok(
    !tableState.cards.table.includes(CARD.WORMTONGUE) &&
      asks.map((pending) => pending.card).join() === CARD.THREATS_AND_PROMISES,
    "Wormtongue discarded when Rohan activates; only Threats and Promises asks",
  );
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
    from: MINION_STATUS.IN_PLAY,
    to: MINION_STATUS.ELIMINATED,
  });
  ok(
    !tableState.cards.table.includes(CARD.PALANTIR),
    "Palantír discarded when Saruman is eliminated",
  );
  asks = engine.fellowshipDeclared(tableState);
  ok(
    asks.length === 1 && asks[0].card === CARD.FLOCKS_OF_CREBAIN,
    "Flocks of Crebain asked about when the Fellowship is declared",
  );
}
// RULES-05: a declaration or an enemy Army activates a passive Nation without an attack, so Threats and Promises asks
// on passive→active instead of discarding itself.
function threatsAndPromisesAsksOnActivation() {
  const tableState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  tableState.cards.table = [CARD.THREATS_AND_PROMISES];
  const asks = engine.tableTriggers(tableState, {
    key: "nations.elves",
    from: FP_STANCE.PASSIVE,
    to: FP_STANCE.ACTIVE,
  });
  ok(
    tableState.cards.table.includes(CARD.THREATS_AND_PROMISES) &&
      asks.length === 1 &&
      asks[0].card === CARD.THREATS_AND_PROMISES &&
      /Fellowship declaration/.test(asks[0].q),
    "Threats and Promises stays on the table and asks when a Nation goes from passive to active",
  );
}
// RULES-03: a declaration leaves the Progress counter Hidden, so Flocks of Crebain and Worn with Sorrow and Toil ask on
// the tracker's Declared button, with the figure in Rivendell (inFPSettlement already true), and not on Revealed.
function declaringTheFellowshipAsksAboutTableCards() {
  const declaredState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  declaredState.cards.table = [
    CARD.FLOCKS_OF_CREBAIN,
    CARD.WORN_WITH_SORROW,
    CARD.THREATS_AND_PROMISES,
  ];
  ok(
    engine.declarationMatters(declaredState),
    "the Declared button is offered with Flocks of Crebain on the table",
  );
  const logBefore = declaredState.log.length;
  const asks = engine.fellowshipDeclared(declaredState);
  ok(
    asks.map((pending) => pending.card).join() ===
      [CARD.FLOCKS_OF_CREBAIN, CARD.WORN_WITH_SORROW].join() &&
      asks.every((pending) =>
        /is that City or Stronghold unconquered/.test(pending.q),
      ) &&
      declaredState.cards.table.length === 3 &&
      !declaredState.board.fs.revealed,
    "the Declared button asks whether the City or Stronghold is unconquered for Flocks of Crebain and Worn with Sorrow and Toil, discards nothing and leaves the Fellowship hidden",
  );
  ok(
    declaredState.log.length === logBefore + 1 &&
      /^Declared pressed: .*City or Stronghold of a Free Peoples Nation/.test(
        declaredState.log.at(-1).text,
      ) &&
      !/unconquered/.test(declaredState.log.at(-1).text),
    "the log records the button press, not whether the City or Stronghold was unconquered",
  );
  declaredState.cards.table = [CARD.THREATS_AND_PROMISES];
  ok(
    !engine.declarationMatters(declaredState),
    "no Declared button without a card a declaration may discard",
  );
  declaredState.board.fs.revealed = true;
  ok(
    engine.tableTriggers(declaredState, {
      key: "fs.revealed",
      from: false,
      to: true,
    }).length === 0,
    "ticking Revealed asks about neither card",
  );
}
// rule 24: Call to Battle cards ignore initiative
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
// Between two combat rounds, a walk from the Jump modal (a card's choice, rule 16) leaves the battle open; Queller's
// next Phase 5 walk closes it.
function sideWalkKeepsTheBattleOpen() {
  const ui = fakeWindow.QB_UI;
  const state = phase5State({
    dice: false,
    cards: false,
    tracker: false,
    wome: false,
  });
  state.battleOpen = true;
  ui.setState(state);
  engine.startWalk(state, "EV", "Event card discard");
  driveWalk(state, []);
  ui.afterWalk();
  const sideWalk = state.walk.result,
    keptOpen = state.battleOpen;
  engine.startPhase(state, PHASE.P5);
  driveWalk(state, []);
  ui.afterWalk();
  ok(
    !!sideWalk && keptOpen && state.walk.done && !state.battleOpen,
    "a Jump-modal walk (" +
      sideWalk +
      ") keeps the battle open; the Phase 5 walk closes it",
  );
}
// A stand-in document just deep enough for ui/render.js and the modal framework to run in Node: every query finds a
// blank element (none finds an open #modal), and nothing ever takes focus.
function fakeElement() {
  return {
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute() {},
    removeAttribute() {},
    hasAttribute: () => false,
    addEventListener() {},
    appendChild() {},
    remove() {},
    focus() {},
    contains: () => false,
    closest: () => null,
    querySelector: () => fakeElement(),
    querySelectorAll: () => [],
  };
}
function withFakeDocument(fn) {
  const body = fakeElement();
  globalThis.document = {
    body,
    documentElement: fakeElement(),
    activeElement: body,
    createElement: fakeElement,
    querySelector: (selector) => (selector === "#modal" ? null : fakeElement()),
    querySelectorAll: () => [],
    getElementById: () => fakeElement(),
  };
  try {
    fn();
  } finally {
    delete globalThis.document;
    fakeWindow.QB_UI.setState(null);
    fakeWindow.QB_UI.setHistory([]);
  }
}
// Opening the Jump modal changes nothing in the game, so it is not an Undo step.
function openingJumpAddsNoUndoStep() {
  const ui = fakeWindow.QB_UI;
  withFakeDocument(() => {
    ui.setState(
      phase5State({ dice: false, cards: false, tracker: false, wome: false }),
    );
    ui.setHistory([]);
    fakeWindow.onPhase(fakeWindow.PHASE_ACTION.JUMP_TO);
    ok(
      ui.history.length === 0 && ui.modal?.name === ui.MODAL.JUMP,
      "the Jump modal opens with no Undo step (" +
        ui.history.length +
        " steps)",
    );
    fakeWindow.closeModal();
  });
}
// The battle form's unsubmitted answers survive a re-render and an Undo of the same game, and go when the game is
// replaced: by another game at a battle form, or by the New game screen and then a loaded game at a battle form.
function battleDraftSurvivesRendersNotANewGame() {
  const ui = fakeWindow.QB_UI;
  const atBattleForm = () => {
    const state = phase5State({
      dice: false,
      cards: true,
      tracker: true,
      wome: false,
    });
    engine.startBattle(state, 1);
    return state;
  };
  const draft = {
    nazLead: 1,
    shadowElite: false,
    seElite: false,
    isengardStronghold: false,
    defInFs: false,
    nearMoria: true,
    figures: { corsairs: false, dunlendings: false, spiders: false },
    underSiege: false,
    attackingSiege: false,
  };
  const nearMoriaTicked = () =>
    /id="bf-nearMoria" [^>]*checked/.test(fakeWindow.gameHTML());
  withFakeDocument(() => {
    ui.setState(atBattleForm());
    ui.setHistory([]);
    fakeWindow.setBattleDraft(draft);
    ui.render();
    ui.act(() => {
      ui.state.board.rings++;
    });
    const afterRender = fakeWindow.battleDraft === draft && nearMoriaTicked();
    fakeWindow.undo();
    const afterUndo = fakeWindow.battleDraft === draft && nearMoriaTicked();
    ui.setState(atBattleForm());
    ui.render();
    const afterReplace = fakeWindow.battleDraft === null && !nearMoriaTicked();
    fakeWindow.setBattleDraft(draft);
    ui.setState(null);
    ui.render();
    ui.setState(atBattleForm());
    ui.render();
    const afterLoad = fakeWindow.battleDraft === null && !nearMoriaTicked();
    ok(
      afterRender && afterUndo && afterReplace && afterLoad,
      "the battle form draft survives a re-render (" +
        afterRender +
        ") and an Undo (" +
        afterUndo +
        "), and goes when another game replaces it (" +
        afterReplace +
        ") or is loaded from the New game screen (" +
        afterLoad +
        ")",
    );
  });
}
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
// An older save (settings.walk, boolean Shadow nations, no rings, the fields since dropped) comes up to date; a
// current save passes through unchanged.
function migrateUpgradesOldSaves() {
  const oldSave = JSON.parse(
    JSON.stringify(
      engine.newState({ dice: true, cards: true, tracker: true, wome: false }),
    ),
  );
  delete oldSave.settings.tracker;
  oldSave.settings.walk = false;
  oldSave.board.nations.sauron = true;
  oldSave.board.nations.isengard = false;
  delete oldSave.board.nations.se;
  delete oldSave.board.rings;
  oldSave.board.chars.saruman = true;
  oldSave.board.chars.mouth = false;
  delete oldSave.board.chars.witchKing;
  oldSave.shownCard = "sa002";
  oldSave.lastAction = { action: "answer" };
  const migrated = engine.migrate(oldSave);
  ok(
    migrated.settings.tracker === false && !("walk" in migrated.settings),
    "settings.walk became settings.tracker",
  );
  ok(
    migrated.board.nations.sauron === 0 &&
      migrated.board.nations.isengard === engine.SHADOW_NATION_START.isengard &&
      migrated.board.nations.se === engine.SHADOW_NATION_START.se,
    "boolean Shadow nations became steps (true → at war, false or missing → the start)",
  );
  ok(
    migrated.board.rings === 0 &&
      !("shownCard" in migrated) &&
      !("lastAction" in migrated),
    "rings added, shownCard and lastAction dropped",
  );
  ok(
    migrated.board.chars.saruman === MINION_STATUS.IN_PLAY &&
      migrated.board.chars.mouth === MINION_STATUS.AVAILABLE &&
      migrated.board.chars.witchKing === MINION_STATUS.AVAILABLE,
    "boolean minions became statuses (true → in play, false or missing → available)",
  );
  const current = engine.newState({ dice: true });
  const before = JSON.stringify(current);
  ok(
    JSON.stringify(engine.migrate(current)) === before,
    "a current save is unchanged by migrate",
  );
}
// WoME setup: its Shadow Event cards replace Shelob's Lair, Corsairs of Umbar and Rage of the Dunlendings, so a new WoME
// game deals none of them (nor the WoME-rev versions), and a WoME game saved with them in its draw decks loses them
// there but keeps a copy already drawn: in hand, or in a discard pile, which is never reshuffled (rule 25). A base game
// keeps the base cards.
function womeDecksLeaveOutReplacedCards() {
  const gone = ["sa034", "sa028", "sa038", "sa028b2", "sa038b2"];
  const inPiles = (state) =>
    Object.values(state.cards.decks)
      .concat(Object.values(state.cards.discards))
      .flat();
  const fresh = engine.newState({ wome: true });
  ok(
    !inPiles(fresh).some((id) => gone.includes(id)),
    "a new WoME game deals none of the cards WoME replaces",
  );
  const base = engine.newState({ wome: false });
  ok(
    ["sa034", "sa028b2", "sa038b2"].every((id) => inPiles(base).includes(id)) &&
      !inPiles(base).some((id) => id === "sa028" || id === "sa038"),
    "a base game deals Shelob's Lair and the base Corsairs and Rage",
  );
  const old = structuredClone(fresh);
  old.cards.decks.C.push("sa034");
  old.cards.decks.S.push("sa028");
  old.cards.discards.S.push("sa038");
  old.cards.hand.push("sa028");
  const migrated = engine.migrate(old);
  ok(
    !Object.values(migrated.cards.decks)
      .flat()
      .some((id) => gone.includes(id)) &&
      migrated.cards.hand.includes("sa028") &&
      migrated.cards.discards.S.includes("sa038"),
    "migrate takes the replaced cards out of a WoME game's draw decks, not its hand or discards",
  );
  const again = JSON.stringify(migrated);
  ok(
    JSON.stringify(engine.migrate(migrated)) === again,
    "migrating the WoME decks twice changes nothing",
  );
  const baseBefore = JSON.stringify(base);
  ok(
    JSON.stringify(engine.migrate(base)) === baseBefore,
    "migrate leaves a base game's decks alone",
  );
}
// Rule 25: an empty Character or Strategy deck is not rebuilt; the Event page draws from the other one, and with both
// empty the draw is not possible. Phase 1 draws only what is there. A Faction Event deck is rebuilt from its discards
// (WoME rules): Servants of Sauron tops up a short Faction deck before it looks at three cards.
function emptyEventDecksFallBack() {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  const characterCards = state.cards.decks.C.slice(0, 3);
  state.cards.decks.C = [];
  state.cards.discards.C = characterCards.slice();
  ok(
    engine.drawCard(state, engine.DECK.CHARACTER) === null &&
      state.cards.hand.length === 0 &&
      state.cards.discards.C.length === 3 &&
      /Character deck is empty/.test(lastLogText(state)),
    "an empty Character deck is not rebuilt from its discards",
  );
  const drawEvent2 = (setUp) => {
    const walkState = phase5State(
      { dice: true, cards: true, tracker: true, wome: false },
      STRATEGY.MILITARY,
    );
    setUp(walkState);
    walkState.dice.pool = [die("Event")];
    walkState.walk = null;
    engine.startWalk(walkState, "EV", "Event 2", {
      die: DIE_REQUIREMENT.EVENT,
      dieIndex: 0,
    });
    return { state: walkState, seen: driveWalk(walkState, []) };
  };
  const fallback = drawEvent2((walkState) => {
    walkState.cards.decks.C = [];
  });
  ok(
    fallback.state.cards.hand.length === 1 &&
      engine.cardById[fallback.state.cards.hand[0]].deck ===
        engine.DECK.STRATEGY &&
      fallback.state.walk.result === WALK_RESULT.ACTION &&
      fallback.seen.some((prompt) =>
        /the Character deck is empty: Queller drew a Strategy card/.test(
          prompt?.text || "",
        ),
      ),
    '"Draw a Character Event card" draws a Strategy card when the Character deck is empty, and says so',
  );
  const bothEmpty = drawEvent2((walkState) => {
    walkState.cards.decks.C = [];
    walkState.cards.decks.S = [];
  });
  ok(
    bothEmpty.state.cards.hand.length === 0 &&
      bothEmpty.state.dice.pool[0].status === DIE_STATE.AVAIL &&
      bothEmpty.state.walk.trail.some((entry) =>
        /rule 25/.test(entry.why || ""),
      ),
    "with both Event decks empty the draw is not possible and the die is kept",
  );
  const phase1 = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  phase1.strategy = STRATEGY.CORRUPTION;
  phase1.cards.discards.S = phase1.cards.decks.S.splice(0, 3);
  phase1.cards.decks.S = [];
  engine.startPhase(phase1, PHASE.P1);
  driveWalk(phase1, []);
  ok(
    phase1.cards.hand.length === 1 &&
      engine.cardById[phase1.cards.hand[0]].deck === engine.DECK.CHARACTER,
    "Phase 1 draws one card when the Strategy deck is empty, and leaves its discards alone",
  );
  const servants = engine.CARDS.find(
    (card) => card.effect === engine.CARD_EFFECT.SERVANTS,
  );
  const factionCards = state.cards.decks.F.slice();
  state.cards.decks.F = factionCards.slice(0, 2);
  state.cards.discards.F = factionCards.slice(2);
  state.cards.factionHand = [];
  const entries = engine.resolveCardEffects(state, servants.id, {
    combat: false,
    die: null,
    palantirBefore: false,
  });
  ok(
    state.cards.factionHand.length === 1 &&
      state.cards.discards.F.length === 0 &&
      state.cards.decks.F.length === factionCards.length - 1 &&
      entries.some((entry) => /keep one of 3 cards/.test(entry.text)),
    "Servants of Sauron topped the two-card Faction deck up from the discards and looked at three",
  );
  const faction = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  faction.cards.discards.F = faction.cards.decks.F.splice(0);
  const factionDiscards = faction.cards.discards.F.slice();
  const drawnFaction = engine.drawCard(faction, engine.DECK.FACTION);
  ok(
    factionDiscards.includes(drawnFaction) &&
      faction.cards.factionHand.length === 1 &&
      faction.cards.discards.F.length === 0 &&
      faction.cards.decks.F.length === factionDiscards.length - 1,
    "an empty Faction Event deck is rebuilt from its discards before the draw",
  );
  const palantir = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  palantir.strategy = STRATEGY.CORRUPTION;
  palantir.cards.decks.C = [];
  const played = engine.CARDS.find(
    (card) => card.deck === engine.DECK.CHARACTER,
  );
  const palantirEntries = engine.resolveCardEffects(palantir, played.id, {
    combat: false,
    die: DIE_REQUIREMENT.EVENT,
    palantirBefore: true,
  });
  ok(
    palantir.cards.hand.length === 1 &&
      engine.cardById[palantir.cards.hand[0]].deck === engine.DECK.STRATEGY &&
      palantirEntries.some((entry) => /drew a Strategy card/.test(entry.text)),
    "the Palantír draws from the Strategy deck when the Character deck is empty",
  );
}
// The draw step before "Above full hand" (EV.drawPrefT, FA.drawT) with nothing to draw keeps the die, as the draw action
// boxes do, rather than following its arrow to End; with cards off the step offers Not possible, which keeps it too.
// The step is reached directly through a temporary arrow from the page's start.
function drawStepWithNoCardKeepsTheDie() {
  const drawStep = (page, start, from, to, req, face, cards) => {
    const state = phase5State({ dice: true, cards, tracker: true, wome: true });
    state.cards.decks.C = [];
    state.cards.decks.S = [];
    state.cards.decks.F = [];
    state.cards.discards.F = [];
    state.dice.pool = [
      req === DIE_REQUIREMENT.EVENT ? die(face) : factionDie(face),
    ];
    state.walk = null;
    let seen = [];
    withTemporaryEdges(FLOW[page].edges, [[from, to]], () => {
      engine.startWalk(state, page, start, { die: req, dieIndex: 0 });
      seen = driveWalk(state, [byType(PROMPT.STEP, "no")]);
    });
    return { state, seen };
  };
  for (const [page, start, from, to, req, face] of [
    ["EV", "Event", "start", "drawPrefT", DIE_REQUIREMENT.EVENT, "Event"],
    [
      "FA",
      "Draw Faction Event",
      "startDraw",
      "drawT",
      DIE_REQUIREMENT.FACTION_DRAW,
      "Wild",
    ],
  ]) {
    const cardsOn = drawStep(page, start, from, to, req, face, true);
    ok(
      cardsOn.state.dice.pool[0].status === DIE_STATE.AVAIL &&
        cardsOn.state.walk.done &&
        cardsOn.state.walk.result !== WALK_RESULT.ACTION,
      page +
        "." +
        to +
        ": with no card to draw the die is kept (" +
        cardsOn.state.dice.pool[0].status +
        ")",
    );
    const cardsOff = drawStep(page, start, from, to, req, face, false);
    const step = cardsOff.seen.find((prompt) => prompt?.node === to);
    ok(
      !!step &&
        engine.offersNotPossible(step, cardsOff.state.walk) &&
        /draw (is )?not possible/.test(step.help) &&
        cardsOff.state.dice.pool[0].status === DIE_STATE.AVAIL &&
        cardsOff.state.walk.done,
      page +
        "." +
        to +
        ": with cards off the draw step explains and offers Not possible, which keeps the die (" +
        cardsOff.state.dice.pool[0].status +
        ")",
    );
  }
  // a prompt saved by version 61 carries only its type, text, node and help
  const saved = drawStep(
    "EV",
    "Event",
    "start",
    "drawPrefT",
    DIE_REQUIREMENT.EVENT,
    "Event",
    false,
  );
  ok(
    engine.offersNotPossible(
      {
        type: PROMPT.STEP,
        text: "Draw a *preferred* Event card",
        node: "drawPrefT",
      },
      saved.state.walk,
    ),
    "a saved draw-step prompt with no flag still offers Not possible",
  );
}
// Servants of Sauron, played from the hand: the top-up of a short Faction deck leaves the played card in the discards,
// so it cannot draw itself; it joins the deck in the reshuffle after the draw.
function servantsOfSauronCannotDrawItself() {
  const servants = "sa_Faction18";
  const state = playFactionCard(servants, (setUp) => {
    setUp.cards.decks.F = ["sa_Faction03", "sa_Faction16"];
    setUp.cards.discards.F = [];
  });
  ok(
    state.cards.factionHand.length === 1 &&
      state.cards.factionHand[0] !== servants &&
      state.cards.decks.F.length === 2 &&
      state.cards.decks.F.includes(servants) &&
      state.cards.discards.F.length === 0 &&
      state.walk.trail.some((entry) => /keep one of 2 cards/.test(entry.text)),
    "Servants of Sauron looks at the two cards of the deck, not at itself, and is reshuffled into the deck after",
  );
}
// WoME rules: the Faction Event deck is reshuffled from its discards as soon as it runs out, not at the next draw.
function factionDeckReshuffledWhenItRunsOut() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  state.cards.factionHand = [];
  state.cards.discards.F = state.cards.decks.F.splice(1);
  const discarded = state.cards.discards.F.length;
  engine.drawCard(state, engine.DECK.FACTION);
  ok(
    state.cards.factionHand.length === 1 &&
      state.cards.decks.F.length === discarded &&
      state.cards.discards.F.length === 0 &&
      /Reshuffled the Faction Event discards/.test(lastLogText(state)),
    "drawing the last Faction Event card reshuffles the discards into a new deck at once",
  );
}
// WoME rules: a Faction Event card that acts on its Faction's figures needs the Faction in play.
function factionCardsNeedTheirFaction() {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  state.board.fs.inFPSettlement = false;
  const playable = (ids) => ids.map((id) => engine.precondition(state, id));
  const cards = [
    "sa_Faction04",
    "sa_Faction08",
    "sa_Faction11",
    "sa_Faction12",
    "sa_Faction13",
  ];
  ok(
    playable(cards).every((met) => met === false),
    "Ships of Great Draught, Death to the Forgoil, The Craft of Shelob, Evil Things and Children of Ungoliant need their Faction",
  );
  state.board.factions.corsairs = true;
  state.board.factions.dunlendings = true;
  state.board.factions.spiders = true;
  ok(
    playable(cards).every((met) => met === true),
    "with their Factions in play they are playable",
  );
  state.board.fs.inFPSettlement = true;
  ok(
    playable(["sa_Faction11", "sa_Faction12", "sa_Faction13"]).join() ===
      "true,false,false",
    "Evil Things and Children of Ungoliant still need the Fellowship outside a Free Peoples Settlement",
  );
}
// WoME rules: a Faction Event card is an Event card, so the Palantír draws after an Event die plays one.
function palantirDrawsAfterAFactionCard() {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  state.cards.table = [CARD.PALANTIR];
  state.cards.factionHand = ["sa_Faction04"];
  engine.playCard(state, "sa_Faction04");
  const entries = engine.resolveCardEffects(state, "sa_Faction04", {
    combat: false,
    die: DIE_REQUIREMENT.EVENT,
    palantirBefore: true,
  });
  ok(
    state.cards.hand.length === 1 &&
      engine.cardById[state.cards.hand[0]].deck === engine.DECK.CHARACTER &&
      entries.some((entry) => /drew a Character card/.test(entry.text)),
    "the Palantír draws a Character card after an Event die plays a Faction Event card",
  );
}
// The hand limit (six Event cards, Faction cards apart): a Faction Event card leaves the Event hand at six, so the Palantír
// draw makes seven and Queller discards one at once by the Event page's discard priority.
function palantirDrawAboveTheHandLimitDiscards() {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  const faction = "sa_Faction01";
  const held = state.cards.decks.S.filter(
    (id) => engine.precondition(state, id) === false,
  ).slice(0, 6);
  state.cards.decks.S = state.cards.decks.S.filter((id) => !held.includes(id));
  state.cards.hand = held;
  state.cards.factionHand = [faction, "sa_Faction04", "sa_Faction08"];
  state.cards.table = [CARD.PALANTIR];
  state.dice.pool = [die("Event")];
  state.walk = null;
  engine.startWalk(state, "EV", "Event", {
    die: DIE_REQUIREMENT.EVENT,
    dieIndex: 0,
  });
  const seen = driveWalk(state, [
    byType(PROMPT.CONFIRM, (prompt) => prompt.card === faction),
  ]);
  const discarded = state.log.filter((entry) =>
    /hand above the limit/.test(entry.text),
  );
  ok(
    seen.some(
      (prompt) => prompt?.type === PROMPT.PLAY_CARD && prompt.card === faction,
    ) &&
      state.cards.hand.length === 6 &&
      discarded.length === 1 &&
      state.walk.trail.some((entry) =>
        /Event hand above the limit/.test(entry.text),
      ),
    "the Palantír's seventh Event card is discarded down to six, with a trail note",
  );
}
// The tracker's table triggers: Worn with Sorrow and Toil asks like Flocks of Crebain; Wormtongue leaves when Saruman does.
function wornWithSorrowAsksAndWormtongueOnSaruman() {
  const state = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  state.cards.table = [CARD.WORN_WITH_SORROW, CARD.WORMTONGUE];
  state.board.chars.saruman = MINION_STATUS.IN_PLAY;
  const asks = engine.fellowshipDeclared(state);
  ok(
    asks.length === 1 &&
      asks[0].card === CARD.WORN_WITH_SORROW &&
      /Worn with Sorrow and Toil/.test(asks[0].q),
    "Worn with Sorrow and Toil asked about when the Fellowship is declared in a Free Peoples settlement",
  );
  engine.tableTriggers(state, {
    key: "chars.saruman",
    from: MINION_STATUS.IN_PLAY,
    to: MINION_STATUS.ELIMINATED,
  });
  ok(
    !state.cards.table.includes(CARD.WORMTONGUE) &&
      state.cards.discards.C.includes(CARD.WORMTONGUE),
    "Wormtongue discarded when Saruman is eliminated",
  );
}
// A Muster die brought back from "set aside for a minion" cannot be set aside again (rule 34): the grey box is skipped
// and the die, unused, is spent. The box is reached directly, since a walk that came from the reserve answers the
// Will of the West check No and never gets there by its arrows.
function reservedDieCannotBeReservedAgain() {
  const state = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  state.dice.pool = [die("Muster")];
  state.walk = null;
  engine.startWalk(state, "MU", "Muster 2", {
    die: DIE_REQUIREMENT.MUSTER,
    dieIndex: 0,
  });
  ok(
    state.walk.prompt?.type === PROMPT.YES_NO,
    "Muster 2 without the tracker asks about the minion",
  );
  state.walk.fromReserve = true;
  state.walk.reservedDieIndex = 0;
  state.walk.node = "saveDie";
  state.walk.prompt = null;
  engine.run(state);
  ok(
    state.walk.done &&
      state.walk.trail.some(
        (entry) =>
          entry.kind === TRAIL.SKIP && /must be used now/.test(entry.why || ""),
      ),
    '"Save muster" skipped for a die that was already set aside',
  );
  ok(
    state.dice.pool[0].status === DIE_STATE.USED &&
      state.walk.result === WALK_RESULT.ACTION &&
      !state.minionReserved,
    "the die is spent rather than set aside again",
  );
}
// "Card allows choice of muster location" is answered from the chosen card when the app holds the cards.
function musterChoiceCardAutoAnswered() {
  const walkMuster3 = (cardId) => {
    const state = phase5State(
      { dice: true, cards: true, tracker: true, wome: false },
      STRATEGY.MILITARY,
    );
    state.cards.hand = [cardId];
    state.dice.pool = [die("Muster")];
    state.walk = null;
    engine.startWalk(state, "MU", "Muster 3/Muster Event card", {
      die: DIE_REQUIREMENT.MUSTER,
      dieIndex: 0,
    });
    ok(
      state.walk.prompt?.type === PROMPT.CONFIRM &&
        state.walk.prompt.card === cardId,
      "the Muster card's playability is confirmed first (" + cardId + ")",
    );
    state.walk.chosen = cardId;
    engine.answer(state, true);
    return state.walk.trail.find(
      (entry) =>
        entry.kind === TRAIL.QUESTION &&
        /choice of muster location/.test(entry.text),
    );
  };
  const choice = walkMuster3("sa018"); // Many Kings to the Service of Mordor: any muster region
  ok(
    choice?.auto && choice.answer === "Yes" && /Many Kings/.test(choice.why),
    "a card that lets Queller choose the muster region answers Yes with the card named",
  );
  const noChoice = walkMuster3("sa019"); // Monsters Roused: a fixed region
  ok(
    noChoice?.auto && noChoice.answer === "No",
    "a card with a fixed muster region answers No",
  );
}
// A Muster 2 walk with the tracker on and one Muster die, driven to its end with every question answered No.
function walkMuster2(setUp, settings = {}) {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false, ...settings },
    STRATEGY.MILITARY,
  );
  setUp(state);
  state.dice.pool = [die("Muster")];
  state.walk = null;
  engine.startWalk(state, "MU", "Muster 2", {
    die: DIE_REQUIREMENT.MUSTER,
    dieIndex: 0,
  });
  driveWalk(state, [[/^Pass/, "no"]]);
  return state;
}
const trailQuestion = (state, pattern) =>
  state.walk.trail.find(
    (entry) => entry.kind === TRAIL.QUESTION && pattern.test(entry.text),
  );
// The Mouth of Sauron follows his card: all Free Peoples nations At War, or the Fellowship on the Mordor track. Every
// Shadow nation at war is not enough, and the Mordor track is enough on its own.
function mouthOfSauronNeedsFreePeoplesAtWarOrMordor() {
  const state = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  for (const nation of engine.SHADOW_NATIONS) state.board.nations[nation] = 0;
  state.board.chars.saruman = MINION_STATUS.IN_PLAY;
  state.board.chars.witchKing = MINION_STATUS.IN_PLAY;
  ok(
    engine.minionsAvailable(state).length === 0,
    "all Shadow nations at war does not offer the Mouth of Sauron",
  );
  state.board.fs.mordor = true;
  let minions = engine.minionsAvailable(state);
  ok(
    minions.length === 1 &&
      minions[0].key === "mouth" &&
      /Mordor/.test(minions[0].why),
    "the Fellowship on the Mordor track offers the Mouth of Sauron",
  );
  state.board.fs.mordor = false;
  for (const nation of engine.FP_NATIONS)
    state.board.nations[nation] = FP_STANCE.WAR;
  minions = engine.minionsAvailable(state);
  ok(
    minions.length === 1 &&
      minions[0].key === "mouth" &&
      /Free Peoples/.test(minions[0].why),
    "all Free Peoples nations at war offers the Mouth of Sauron",
  );
  state.board.nations.dwarves = FP_STANCE.ACTIVE;
  ok(
    engine.minionsAvailable(state).length === 0,
    "one Free Peoples nation short of war withholds him again",
  );
  const mordorWalk = walkMuster2((walkState) => {
    walkState.board.chars.saruman = MINION_STATUS.IN_PLAY;
    walkState.board.chars.witchKing = MINION_STATUS.IN_PLAY;
    walkState.board.fs.mordor = true;
  });
  const recruit = trailQuestion(mordorWalk, /Able to recruit a minion/);
  ok(
    recruit?.auto &&
      recruit.answer === "Yes" &&
      mordorWalk.board.chars.mouth === MINION_STATUS.IN_PLAY,
    "a Muster 2 walk musters the Mouth of Sauron when the Fellowship is in Mordor",
  );
  const noMordorWalk = walkMuster2((walkState) => {
    for (const nation of engine.SHADOW_NATIONS)
      walkState.board.nations[nation] = 0;
    walkState.board.chars.saruman = MINION_STATUS.IN_PLAY;
    walkState.board.chars.witchKing = MINION_STATUS.IN_PLAY;
  });
  ok(
    trailQuestion(noMordorWalk, /Able to recruit a minion/)?.answer === "No" &&
      noMordorWalk.board.chars.mouth === MINION_STATUS.AVAILABLE,
    "a Muster 2 walk does not muster him on Shadow nations at war alone",
  );
  state.board.chars.mouth = MINION_STATUS.ELIMINATED;
  ok(
    engine.diceCount(state) === engine.BASE_ACTION_DICE + 2,
    "an eliminated Mouth of Sauron adds no die",
  );
}
// An eliminated Character is removed from the game (rulebook): a minion set to eliminated is never offered again, the
// Will of the West check knows a minion was recruited, and the Palantír and Wormtongue leave the table with Saruman.
function eliminatedMinionIsNeverMusteredAgain() {
  const state = phase5State({
    dice: true,
    cards: false,
    tracker: true,
    wome: false,
  });
  state.board.nations.isengard = 0;
  state.board.chars.saruman = MINION_STATUS.ELIMINATED;
  ok(
    engine.minionsAvailable(state).length === 0,
    "an eliminated Saruman is not offered with Isengard at war",
  );
  const walk = walkMuster2((walkState) => {
    walkState.board.nations.isengard = 0;
    walkState.board.chars.saruman = MINION_STATUS.ELIMINATED;
  });
  ok(
    trailQuestion(walk, /Able to recruit a minion/)?.answer === "No" &&
      walk.board.chars.saruman === MINION_STATUS.ELIMINATED,
    "a Muster 2 walk does not muster an eliminated Saruman",
  );
  const witchKingWalk = walkMuster2((walkState) => {
    walkState.board.nations.isengard = 0;
    walkState.board.nations.sauron = 0;
    walkState.board.nations.gondor = FP_STANCE.WAR;
    walkState.board.chars.saruman = MINION_STATUS.ELIMINATED;
  });
  const wotw = trailQuestion(witchKingWalk, /Will of the West/);
  ok(
    wotw?.auto && wotw.answer === "No" && /eliminated/.test(wotw.why),
    "the Will of the West check answers No because a minion was recruited and eliminated",
  );
  ok(
    witchKingWalk.board.chars.witchKing === MINION_STATUS.IN_PLAY &&
      witchKingWalk.board.chars.saruman === MINION_STATUS.ELIMINATED,
    "the Witch King is mustered instead",
  );
  const noTracker = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  noTracker.board.chars.saruman = MINION_STATUS.ELIMINATED;
  noTracker.dice.pool = [die("Muster")];
  noTracker.walk = null;
  engine.startWalk(noTracker, "MU", "Muster 2", {
    die: DIE_REQUIREMENT.MUSTER,
    dieIndex: 0,
  });
  const seen = driveWalk(noTracker, [
    [/Able to recruit a minion/, true],
    [/Will of the West/, false],
  ]);
  const choice = seen.find((prompt) => prompt?.type === PROMPT.CHOICE);
  const labels = (choice?.options || []).map((option) => option.label);
  ok(
    choice &&
      /not eliminated/.test(choice.text) &&
      !labels.some((label) => /Saruman/.test(label)) &&
      labels.some((label) =>
        /Mouth of Sauron \(all Free Peoples Nations At War, or the Fellowship on the Mordor Track\)/.test(
          label,
        ),
      ),
    "without the tracker the minion choice omits an eliminated Saruman and states the Mouth's condition",
  );
  const tableState = phase5State({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  tableState.cards.table = [CARD.WORMTONGUE, CARD.PALANTIR];
  tableState.board.chars.saruman = MINION_STATUS.IN_PLAY;
  engine.tableTriggers(tableState, {
    key: "chars.saruman",
    from: MINION_STATUS.IN_PLAY,
    to: MINION_STATUS.AVAILABLE,
  });
  ok(
    tableState.cards.table.includes(CARD.WORMTONGUE) &&
      tableState.cards.table.includes(CARD.PALANTIR),
    "setting Saruman back to available discards nothing",
  );
  engine.tableTriggers(tableState, {
    key: "chars.saruman",
    from: MINION_STATUS.AVAILABLE,
    to: MINION_STATUS.ELIMINATED,
  });
  ok(
    !tableState.cards.table.includes(CARD.WORMTONGUE) &&
      !tableState.cards.table.includes(CARD.PALANTIR),
    "setting Saruman to eliminated discards Wormtongue and the Palantír",
  );
}
// "A Power too Great" / "The Power of Tom Bombadil" (rule 19): Not possible on a Phase 5 action asks whether such a
// card blocked it; if so, Queller pays one Action die (the action's own when it can), one Army Event card and one
// Character card (chosen by the Event page discard priority, rule 16), and that is its action. A Faction Army card
// does not count; when Queller cannot pay, the action is not possible and nothing is spent.
const FORCE_SETTINGS = { dice: true, cards: true, tracker: true, wome: true };
// A military Phase 5 walk stopped at "Attack using character die", holding the Character die (index 2).
function atBlockedAttack(hand, settings = FORCE_SETTINGS) {
  const state = phase5State(settings, STRATEGY.MILITARY);
  state.cards.hand = hand;
  state.dice.pool = [
    die("Army"),
    die("Army"),
    die("Character"),
    die("Muster"),
    { kind: engine.DIE_KIND.FACTION, face: "Faction", status: DIE_STATE.AVAIL },
  ];
  engine.startPhase(state, PHASE.P5);
  let guard = 0;
  while (
    !state.walk.done &&
    state.walk.prompt.type !== PROMPT.ACTION &&
    guard++ < 60
  ) {
    const prompt = state.walk.prompt;
    engine.answer(
      state,
      engine.YES_NO_PROMPTS.includes(prompt.type) ? true : "done",
    );
  }
  return state;
}
// Press Not possible; when the follow-up question comes, answer it. Returns whether it came.
function notPossibleThen(state, blockedAnswer) {
  engine.answer(state, "no");
  const asked = state.walk.prompt?.type === PROMPT.BLOCKED;
  if (asked) engine.answer(state, blockedAnswer);
  return asked;
}
const usedDice = (state) =>
  state.dice.pool.filter((pooled) => pooled.status === DIE_STATE.USED);
function forcedDiscardPaysArmyCharacterAndActionDie() {
  const state = atBlockedAttack(["sa013", "sa014", "sa010", "sa008", "sa002"]);
  const actionDie = state.dice.pool[state.walk.dieIndex];
  ok(
    state.walk.prompt.type === PROMPT.ACTION && actionDie.face === "Character",
    "set-up: a Phase 5 attack prompt holding the Character die",
  );
  ok(
    notPossibleThen(state, "powerTooGreat"),
    "Not possible asks whether a Free Peoples card blocked the action",
  );
  ok(
    state.cards.hand.length === 3 &&
      state.cards.hand.includes("sa002") &&
      state.cards.hand.includes("sa010") &&
      ["sa013", "sa014"].filter((id) => state.cards.hand.includes(id))
        .length === 1,
    "one Army Event card and one Character card are discarded, by the Event page priority (the tile card stays)",
  );
  ok(
    actionDie.status === DIE_STATE.USED && usedDice(state).length === 1,
    "the blocked action's own die pays, and no other die is used",
  );
  ok(
    state.walk.done &&
      state.walk.result === WALK_RESULT.ACTION &&
      state.log.some((entry) =>
        entry.text.includes("Queller removes “A Power too Great”"),
      ),
    "removing the card is Queller's action: the walk ends and the log names the card",
  );

  const answeredNo = atBlockedAttack(["sa013", "sa008"]);
  notPossibleThen(answeredNo, "no");
  ok(
    answeredNo.cards.hand.length === 2 && !usedDice(answeredNo).length,
    "answering No is the usual Not possible: nothing is paid",
  );
  const noCharacter = atBlockedAttack(["sa013"]);
  noCharacter.cards.factionHand = ["sa_Faction04"];
  notPossibleThen(noCharacter, "bombadil");
  ok(
    noCharacter.cards.hand.length === 1 &&
      !usedDice(noCharacter).length &&
      noCharacter.walk.trail.some((entry) =>
        String(entry.answer).includes("cannot pay"),
      ),
    "Queller cannot pay (no Character card; a Faction Army card does not count): not possible, nothing spent",
  );
  for (const [why, spoil] of [
    [
      "the app does not hold Queller's cards",
      (s) => (s.settings.cards = false),
    ],
    ["its die already paid for a move", (s) => (s.walk.dieUsed = true)],
    ["it is a battle walk", (s) => (s.walk.entry.page = "BA")],
    [
      "it holds the Muster die set aside for a minion",
      (s) => (s.walk.fromReserve = true),
    ],
    ["it holds no die", (s) => (s.walk.die = null)],
  ]) {
    const notAsked = atBlockedAttack(["sa013", "sa008"]);
    spoil(notAsked);
    ok(
      !notPossibleThen(notAsked, "powerTooGreat") &&
        notAsked.cards.hand.length === 2,
      "no question when " + why,
    );
  }
  const factionDieAction = atBlockedAttack(["sa013", "sa008"]);
  factionDieAction.walk.dieIndex = 4;
  notPossibleThen(factionDieAction, "bombadil");
  ok(
    usedDice(factionDieAction).length === 1 &&
      usedDice(factionDieAction)[0].kind === engine.DIE_KIND.ACTION &&
      factionDieAction.dice.pool[4].status === DIE_STATE.AVAIL,
    "an action holding the Faction die is paid with an Action die; the Faction die stays free",
  );
  const ownDieMarkedUsed = atBlockedAttack(["sa013", "sa008"]);
  ownDieMarkedUsed.dice.pool[2].status = DIE_STATE.USED;
  notPossibleThen(ownDieMarkedUsed, "bombadil");
  ok(
    usedDice(ownDieMarkedUsed).length === 2 && ownDieMarkedUsed.walk.done,
    "an action die the player already marked used never pays; another Action die does",
  );
  const unclaimed = atBlockedAttack(["sa013", "sa008"]);
  unclaimed.walk.dieIndex = null;
  unclaimed.dice.pool.push(die("Character"));
  notPossibleThen(unclaimed, "bombadil");
  ok(
    usedDice(unclaimed).length === 1 &&
      usedDice(unclaimed)[0].face === "Character",
    "an action holding a requirement but no claimed die pays with a die matching it",
  );
  const factionWild = atBlockedAttack(["sa013", "sa008"]);
  factionWild.dice.pool = [
    { kind: engine.DIE_KIND.FACTION, face: "Wild", status: DIE_STATE.AVAIL },
    die("Muster"),
    die("Character"),
  ];
  factionWild.walk.dieIndex = null;
  // Character is preferred under Corruption: the non-preferred fallback would pay with the Muster die
  factionWild.strategy = STRATEGY.CORRUPTION;
  notPossibleThen(factionWild, "powerTooGreat");
  ok(
    factionWild.dice.pool[2].status === DIE_STATE.USED &&
      factionWild.dice.pool[0].status === DIE_STATE.AVAIL &&
      factionWild.dice.pool[1].status === DIE_STATE.AVAIL,
    "a matching Action die pays before a non-matching one, never the Faction Wild",
  );
  const noDie = atBlockedAttack(["sa013", "sa008"]);
  noDie.dice.pool.forEach((pooled) => {
    if (pooled.kind === engine.DIE_KIND.ACTION) pooled.status = DIE_STATE.USED;
  });
  noDie.walk.dieIndex = null;
  notPossibleThen(noDie, "powerTooGreat");
  ok(
    noDie.cards.hand.length === 2,
    "no unused Action die: Queller cannot pay and keeps its cards",
  );
  const diceOff = atBlockedAttack(["sa013", "sa008"], {
    ...FORCE_SETTINGS,
    dice: false,
  });
  ok(
    diceOff.walk.prompt?.type === PROMPT.ACTION &&
      notPossibleThen(diceOff, "powerTooGreat") &&
      diceOff.cards.hand.length === 0 &&
      diceOff.walk.done,
    "with dice off the cards are discarded and the walk ends; the player sets aside the die",
  );
}
// Draft flowchart: the Phases 1-4 discard list picks one card and "Discard one card" discards it, then the walk
// checks the hand again, so the hand comes down one card at a time.
function discardLoopDiscardsOneCardAtATime() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  state.strategy = STRATEGY.CORRUPTION;
  state.cards.hand = state.cards.decks[engine.DECK.CHARACTER]
    .splice(0, 5)
    .concat(state.cards.decks[engine.DECK.STRATEGY].splice(0, 2));
  engine.startPhase(state, PHASE.P1);
  driveWalk(state, []);
  const discards = state.walk.trail.filter(
    (entry) => entry.text === "Discard one card",
  );
  ok(
    state.cards.hand.length === 6 && discards.length === 3,
    "nine cards come down to six in three passes (" +
      discards.length +
      " discards, hand " +
      state.cards.hand.length +
      ")",
  );
}
// Draft flowchart: on the Army page an Army/Muster die tries "Muster 3" before the last-resort move; an Army die does not.
function armyMusterDieTriesMuster3First() {
  const walkArmy4 = (face) => {
    const state = phase5State(
      { dice: true, cards: false, tracker: true, wome: false },
      STRATEGY.MILITARY,
    );
    state.dice.pool = [die(face)];
    engine.startWalk(state, "AR", "Army 4", {
      die: DIE_REQUIREMENT.ARMY,
      dieIndex: 0,
    });
    driveWalk(state, []);
    return state.walk;
  };
  const armyMuster = walkArmy4("Army/Muster");
  ok(
    trailQuestion({ walk: armyMuster }, /Using an Army\/Muster die/)?.answer ===
      "Yes" &&
      armyMuster.trail.some(
        (entry) => entry.kind === TRAIL.JUMP && entry.text === "Muster 3",
      ) &&
      trailQuestion({ walk: armyMuster }, /^An Army can move/),
    "an Army/Muster die walks Muster 3, then comes back to the last-resort move",
  );
  const withCard = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  const musterCard = withCard.cards.decks[engine.DECK.STRATEGY].find(
    (id) => engine.cardById[id].type === "Muster",
  );
  withCard.cards.hand = [musterCard];
  withCard.dice.pool = [die("Army/Muster")];
  engine.startWalk(withCard, "AR", "Army 4", {
    die: DIE_REQUIREMENT.ARMY,
    dieIndex: 0,
  });
  const cardPrompts = driveWalk(withCard, [byType(PROMPT.CONFIRM, true)]);
  ok(
    !cardPrompts.some((prompt) => prompt?.type === PROMPT.PLAY_CARD) &&
      /cannot play an Event card/.test(
        trailQuestion(withCard, /Muster card/)?.why || "",
      ),
    "Muster 3 with an Army/Muster die plays no Muster card",
  );
  const army = walkArmy4("Army");
  ok(
    trailQuestion({ walk: army }, /Using an Army\/Muster die/)?.answer ===
      "No" && !army.trail.some((entry) => entry.text === "Muster 3"),
    "an Army die goes straight to the last-resort move",
  );
}
// Draft flowchart: a defender that retreated ends the battle; Queller goes to "Battle (advance)".
function retreatedDefenderSendsQuellerToAdvance() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  engine.startBattle(state, 2);
  const seen = driveWalk(state, [[/has retreated/, true]]);
  ok(
    state.walk.trail.some(
      (entry) => entry.kind === TRAIL.JUMP && entry.text === "Battle (advance)",
    ) &&
      seen.some(
        (prompt) =>
          prompt?.node === "anyCond" &&
          prompt.items?.includes("Enemy retreated into its Stronghold"),
      ),
    "the retreat question leads to the advance box, which lists the retreat into the Stronghold",
  );
}
// Draft flowchart: the second "Shadow Army attacking" (after casualties) takes the round's earlier answer.
function secondAttackingQuestionReusesTheRound() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  engine.startBattle(state, 2);
  const seen = driveWalk(state, [[/^Shadow Army attacking$/, true]]);
  const asked = seen.filter(
    (prompt) => prompt?.text === "Shadow Army attacking",
  ).length;
  const second = state.walk.trail.filter(
    (entry) => entry.text === "Shadow Army attacking",
  )[1];
  ok(
    asked === 1 && second?.auto && second.answer === "Yes",
    "asked once; the second box answers Yes by itself",
  );
}
// Draft flowchart: with no die set aside, "Use Muster die set aside for minion" follows its arrow to
// "Discard unplayable die".
function noSetAsideDieFallsThroughToDiscard() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  state.dice.pool = [die("Character")];
  engine.startWalk(state, "M5", "Phase 5");
  state.walk.node = "minionDie";
  state.walk.prompt = null;
  engine.run(state);
  ok(
    state.walk.result === WALK_RESULT.ACTION &&
      state.dice.pool[0].status === DIE_STATE.USED &&
      state.walk.trail.some(
        (entry) =>
          entry.kind === TRAIL.SKIP &&
          /no Muster die set aside/.test(entry.why),
      ),
    "the walk goes on to discard the unplayable die",
  );
}
// Draft flowchart: on the Event page a Character die plays any playable Character card, and "Draw a Character
// Event card" needs an Event die.
function eventPageChecksTheDie() {
  const event2 = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  event2.dice.pool = [die("Character")];
  event2.walk = null;
  engine.startWalk(event2, "EV", "Event 2", {
    die: DIE_REQUIREMENT.CHARACTER,
    dieIndex: 0,
  });
  driveWalk(event2, []);
  const less4 = trailQuestion(event2, /^Using an Event die and holding less/);
  ok(
    less4?.auto && less4.answer === "No" && /Character/.test(less4.why),
    "with a Character die, Event 2 does not draw a Character Event card",
  );
  const military = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  const characterCard = military.cards.decks[engine.DECK.CHARACTER].find(
    (id) => !engine.cardById[id].pre,
  );
  military.cards.hand = [characterCard];
  military.dice.pool = [die("Character")];
  military.walk = null;
  engine.startWalk(military, "EV", "Event", {
    die: DIE_REQUIREMENT.CHARACTER,
    dieIndex: 0,
  });
  const seen = driveWalk(military, [byType(PROMPT.CONFIRM, true)]);
  ok(
    seen.some(
      (prompt) =>
        prompt?.type === PROMPT.PLAY_CARD && prompt.card === characterCard,
    ),
    "a Military Character die plays a playable Character card that is not preferred",
  );
  // the Jump modal can start the page holding no die: the die boxes are then the player's to answer
  const noDie = phase5State(
    { dice: true, cards: true, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  noDie.cards.hand = [characterCard];
  noDie.walk = null;
  engine.startWalk(noDie, "EV", "Event");
  const asked = driveWalk(noDie, [byType(PROMPT.CONFIRM, true)]);
  ok(
    asked.some(
      (prompt) => prompt?.type === PROMPT.YES_NO && prompt.node === "charCard",
    ),
    "holding no die, the Character-card box is asked, not answered from the hand",
  );
}
// A walk saved on the released flowchart resumes on load on the new graph; a finished one and a current one are kept.
function savedWalkFromReleasedFlowchartResumes() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  engine.startBattle(state, 2);
  state.battleOpen = true;
  const current = engine.migrate(JSON.parse(JSON.stringify(state)));
  ok(
    current.walk?.flowRev === engine.FLOW_REV && current.battleOpen,
    "a walk on this flowchart survives migrate",
  );
  const old = JSON.parse(JSON.stringify(state));
  delete old.walk.flowRev;
  delete old.walk.attacking;
  const resumed = engine.migrate(old);
  ok(
    resumed.walk?.node === "downgrade" &&
      resumed.walk.flowRev === engine.FLOW_REV &&
      resumed.walk.attacking === null &&
      resumed.battleOpen,
    "an unfinished walk from the released flowchart resumes where it stood, so nothing it did is done twice",
  );
  const redrawn = JSON.parse(JSON.stringify(state));
  delete redrawn.walk.flowRev;
  redrawn.walk.page = "C14";
  redrawn.walk.node = "disc14";
  redrawn.walk.prompt = {
    type: PROMPT.STEP,
    text: "Discard priority:",
    node: "disc14",
  };
  const moved = engine.migrate(redrawn).walk;
  ok(
    moved.node === "discOne14" && moved.prompt.node === "discOne14",
    "a walk paused at a step that became a priority list moves, with its open prompt, to the step drawn after it",
  );
  const reserved = JSON.parse(JSON.stringify(state));
  delete reserved.walk.flowRev;
  reserved.walk.stack = [
    {
      page: "M5",
      node: "minionDie",
      die: null,
      dieIndex: null,
      dieUsed: false,
    },
  ];
  reserved.walk.minionPick = "Witch King";
  reserved.walk.prompt = {
    type: PROMPT.YES_NO,
    text: "ANY condition true:",
    items: ["a", "b"],
    any: true,
    options: [{ value: "Witch King", label: "Witch King" }],
  };
  const fixed = engine.migrate(reserved).walk;
  ok(
    fixed.stack.length === 0 &&
      fixed.minionPick === "Witch-king" &&
      fixed.prompt.conditions &&
      fixed.prompt.options[0].value === "Witch-king",
    "a resumed walk loses the set-aside die's return frame, and takes the new Witch-king spelling and list markup",
  );
  const finished = JSON.parse(JSON.stringify(state));
  delete finished.walk.flowRev;
  finished.walk.done = true;
  ok(
    engine.migrate(finished).walk?.done === true,
    "a finished walk from the released flowchart is kept",
  );
}
// test/fixtures/v61-army-walk.json is a game saved by version 61 (commit 10960ec) part-way through the Army page,
// entered from M5's "Army" jump with an Army die: it resumes with the walk fields added since, and its Army die makes
// both moves (rule 9). It was made with v61's own code: dice on, cards off, Military, one Army die, startPhase(P5),
// then Yes to "Shadow under threat", No to "Mobile army adjacent", Yes to "Move can create" (the Character move is
// skipped and jArmyT enters AR), saved at AR.threatEx.
const V61_ARMY_WALK = readFileSync(
  new URL("./fixtures/v61-army-walk.json", import.meta.url),
  "utf8",
);
const V61_ARMY_RULES = [
  [/adjacent\* to \*threat/, false],
  byType(PROMPT.YES_NO, true),
];
function toArmyMove(state) {
  for (
    let guard = 0;
    guard < 20 && state.walk.prompt && state.walk.prompt.type !== PROMPT.ACTION;
    guard++
  )
    engine.answer(state, ruleAnswer(state.walk.prompt, V61_ARMY_RULES));
  return state.walk.prompt;
}
function answerWithoutThrowing(state, value) {
  try {
    engine.answer(state, value);
    return true;
  } catch (error) {
    console.log("     threw:", error.message);
    return false;
  }
}
function version61ArmyWalkResumesAndEnds() {
  const saved = JSON.parse(V61_ARMY_WALK);
  ok(
    saved.appVersion === 61 &&
      saved.walk.page === "AR" &&
      !("armyStart" in saved.walk) &&
      !("flowRev" in saved.walk),
    "the fixture is a version 61 walk on the Army page, without the fields added since",
  );
  const state = engine.migrate(JSON.parse(V61_ARMY_WALK));
  const walk = state.walk;
  ok(
    walk.armyStart === "Army" &&
      walk.armyMoves === 0 &&
      walk.messengerAns === null &&
      walk.dieViaMessenger === false &&
      walk.stack.every((frame) => frame.dieViaMessenger === false) &&
      walk.flowRev === engine.FLOW_REV,
    "migrate gives the walk its Army start point (from the trail's Army jump) and the defaults of the newer fields",
  );
  const move = toArmyMove(state);
  const answered = move.armyMove && answerWithoutThrowing(state, "done");
  ok(
    answered && state.walk.armyMoves === 1 && !state.walk.done,
    "the first Army move of the resumed walk walks the Army page again for the second",
  );
  if (answered && !state.walk.done) {
    toArmyMove(state);
    engine.answer(state, "done");
  }
  ok(
    state.walk.done &&
      state.walk.result === WALK_RESULT.ACTION &&
      state.dice.pool[0].status === DIE_STATE.USED,
    "the resumed walk ends after the second move, with the Army die spent",
  );
  const back = engine.migrate(JSON.parse(V61_ARMY_WALK));
  let returned = true;
  try {
    driveWalk(back, []);
  } catch (error) {
    console.log("     threw:", error.message);
    returned = false;
  }
  ok(
    returned && back.walk.done,
    "answered No throughout, the resumed walk returns to M5 through its saved frame and ends",
  );
  const lost = engine.migrate(JSON.parse(V61_ARMY_WALK));
  const lostMove = toArmyMove(lost);
  lost.walk.armyStart = "Nowhere";
  ok(
    lostMove.armyMove &&
      answerWithoutThrowing(lost, "done") &&
      lost.walk.done &&
      lost.dice.pool[0].status === DIE_STATE.USED,
    "with an Army start point that does not exist, the move ends the walk and spends the die",
  );
  const fromArmy = JSON.parse(V61_ARMY_WALK);
  fromArmy.walk.entry = { page: "AR", start: "Army 2" };
  fromArmy.walk.trail = fromArmy.walk.trail.filter(
    (entry) => entry.kind !== TRAIL.JUMP,
  );
  fromArmy.walk.stack = [];
  ok(
    engine.migrate(fromArmy).walk.armyStart === "Army 2",
    "a walk that began on the Army page takes its own start point",
  );
  const newer = JSON.parse(V61_ARMY_WALK);
  newer.walk.flowRev = engine.FLOW_REV + 1;
  ok(
    engine.migrate(newer).walk.flowRev === engine.FLOW_REV + 1,
    "a walk from a newer flowchart keeps its revision",
  );
  const onMuster = JSON.parse(V61_ARMY_WALK);
  onMuster.walk.stack.push({
    page: "AR",
    node: "jMuster3",
    die: null,
    dieIndex: null,
    dieUsed: false,
  });
  onMuster.walk.trail.push({
    kind: TRAIL.JUMP,
    text: "Muster 3",
    page: "AR",
    node: "jMuster3",
  });
  onMuster.walk.page = "MU";
  onMuster.walk.node = "start3";
  const offArmy = JSON.parse(V61_ARMY_WALK);
  offArmy.walk.page = "M5";
  offArmy.walk.stack = [];
  ok(
    engine.migrate(onMuster).walk.armyStart === "Army" &&
      engine.migrate(offArmy).walk.armyStart === null,
    "a walk on the Muster page that returns to the Army page takes its Army start point; one that does not, none",
  );
}
// test/fixtures/v61-army-move.json is the same v61 walk saved at the Army page's "Move" action (No to both
// "adjacent to threat" questions, Yes to the rest), whose prompt v61 drew without the second-move flags.
function version61ArmyMovePromptGetsBothMoves() {
  const state = engine.migrate(
    JSON.parse(
      readFileSync(
        new URL("./fixtures/v61-army-move.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  ok(
    state.walk.prompt.type === PROMPT.ACTION &&
      state.walk.prompt.armyMove === true &&
      !state.walk.prompt.moveOrAttack,
    "the saved Move prompt takes the flags that ask about the second Army move",
  );
  const first = answerWithoutThrowing(state, "done");
  ok(
    first && state.walk.armyMoves === 1 && !state.walk.done,
    "its first move walks the Army page again for the second",
  );
  if (first && !state.walk.done) {
    toArmyMove(state);
    engine.answer(state, "done");
  }
  ok(
    state.walk.done && state.dice.pool[0].status === DIE_STATE.USED,
    "the second move ends the walk with the Army die spent",
  );
}
// The walk of a current game at the point the v61 fixture was saved, for the fields a migrated walk must have.
function currentArmyWalk() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  state.dice.pool = [die("Army")];
  engine.startPhase(state, PHASE.P5);
  for (let guard = 0; guard < 20 && state.walk.page !== "AR"; guard++)
    engine.answer(
      state,
      /^Shadow under|^Move can create/.test(state.walk.prompt.text),
    );
  return state.walk;
}
// A field added to the walk or its stack frames without a migrate default fails here.
function migratedWalkHasEveryField() {
  const fresh = currentArmyWalk();
  const migrated = engine.migrate(JSON.parse(V61_ARMY_WALK)).walk;
  const missing = (current, old) =>
    Object.keys(current).filter((key) => !(key in old));
  const walkGaps = missing(fresh, migrated);
  const frameGaps =
    fresh.page === "AR" && fresh.stack.length
      ? missing(fresh.stack[0], migrated.stack[0])
      : ["(no fresh frame)"];
  ok(
    walkGaps.length === 0 && frameGaps.length === 0,
    "the migrated v61 walk and its frame have every field a current one has" +
      (walkGaps.length + frameGaps.length
        ? " (missing: " + [...walkGaps, ...frameGaps].join(", ") + ")"
        : ""),
  );
}
// Every grey box that enters the Army page, as its trail entry reads, gives a migrated walk that box's start point.
function migratedArmyStartForEveryArmyJump() {
  const wrong = [];
  let boxes = 0;
  for (const [pageKey, page] of Object.entries(FLOW))
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      if (NODE.kind(node) !== fakeWindow.QB_NODE_KIND.JUMP) continue;
      const spec = engine.jumpSpec(NODE.text(node));
      if (spec?.page !== "AR") continue;
      boxes++;
      const save = JSON.parse(V61_ARMY_WALK);
      save.walk.trail = [
        save.walk.trail[0],
        {
          kind: TRAIL.JUMP,
          text: engine.normalizeText(NODE.text(node)),
          page: pageKey,
          node: nodeId,
        },
      ];
      if (engine.migrate(save).walk.armyStart !== spec.start)
        wrong.push(pageKey + "." + nodeId);
    }
  ok(
    boxes > 0 && wrong.length === 0,
    "every Army jump's trail text migrates to its start point (" +
      boxes +
      " boxes" +
      (wrong.length ? "; wrong: " + wrong.join(", ") : "") +
      ")",
  );
}
// Draft flowchart: "Use Muster die set aside for minion" now comes before "Discard unplayable die". When Muster 2
// finds nothing for the die brought back, that die is spent (rule 34); "Discard unplayable die" does not pick another.
function reservedDieSpentBeforeDiscardingAnother() {
  // "Discard unplayable die" picks at random, so a wrong pick shows only in some walks: run enough of them
  let wrong = 0;
  for (let trial = 0; trial < RANDOM_PICK_TRIALS; trial++) {
    const state = phase5State(
      { dice: true, cards: false, tracker: true, wome: false },
      STRATEGY.MILITARY,
    );
    state.board.nations.isengard = 0;
    state.dice.pool = [die("Muster", DIE_STATE.RESERVED), die("Character")];
    state.minionReserved = true;
    engine.startPhase(state, PHASE.P5);
    driveWalk(state, [[/^Pass/, "no"], byType(PROMPT.ACTION, "no")]);
    if (
      state.dice.pool[0].status !== DIE_STATE.USED ||
      state.dice.pool[1].status !== DIE_STATE.AVAIL ||
      state.minionReserved
    )
      wrong++;
  }
  ok(
    wrong === 0,
    "the set-aside Muster die is spent and the Character die is left, in every walk (" +
      wrong +
      " of " +
      RANDOM_PICK_TRIALS +
      " wrong)",
  );
}
// Dice off: the set-aside Muster die that finds no action in Muster 2 is spent too, so the walk is an action.
function reservedDieSpentWithDiceOff() {
  const state = phase5State(
    { dice: false, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  state.board.nations.isengard = 0;
  state.minionReserved = true;
  engine.startPhase(state, PHASE.P5);
  driveWalk(state, [[/^Pass/, "no"], byType(PROMPT.ACTION, "no")]);
  ok(
    state.walk.result === WALK_RESULT.ACTION &&
      /sets aside the Muster die it had kept for a minion/.test(
        lastLogText(state),
      ) &&
      state.log.some(
        (entry) =>
          entry.text ===
          "Queller used a Muster die — set aside for a minion, no action possible.",
      ),
    "the set-aside Muster die with no action is spent, and the walk is Queller's action",
  );
}
// The army value calculator counts a Captain of the West once: he adds a combat die, not a point of his own.
function captainOfTheWestCountsOnce() {
  const inputs = (extra) => ({
    reg: 3,
    elite: 0,
    lead: 1,
    cotw: 0,
    fort: false,
    strong: false,
    sortie: false,
    ...extra,
  });
  ok(
    fakeWindow.armyValue(inputs({})).value === 7 &&
      fakeWindow.armyValue(inputs({ cotw: 1 })).value === 8 &&
      fakeWindow.armyValue(inputs({ reg: 5, lead: 0, cotw: 1 })).value === 10,
    "3 Regulars and 1 Leadership: 7, 8 with a Captain; 5 Regulars and a Captain: 10 (combat dice capped at 5)",
  );
}
// Rules 43 and 46: a ring use stands only when the die it made is spent. Here the threat column's Character attack is
// not possible, so that ring comes back, and the Army attack's ring is the one used.
function ringReturnedWhenItsStepIsNotPossible() {
  const ringState = (dice) => {
    const state = phase5State({
      dice: true,
      cards: false,
      tracker: false,
      wome: false,
    });
    state.board.rings = 1;
    state.dice.pool = dice.map((face) => die(face));
    engine.startPhase(state, PHASE.P5);
    return state;
  };
  const attacked = ringState(["Event", "Event"]);
  driveWalk(attacked, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
    [/Attack using Character/, "no"],
    [/Attack using Army/, "done"],
  ]);
  const faces = attacked.dice.pool.map((pooled) => pooled.face).sort();
  ok(
    attacked.walk.result === WALK_RESULT.ACTION &&
      attacked.board.rings === 0 &&
      attacked.ringUsedThisTurn &&
      faces.join() === "Army,Event" &&
      attacked.walk.trail.some((entry) =>
        /not used for a Character die/.test(entry.text),
      ),
    "the Character die turns back and the ring makes the Army die instead (" +
      faces.join() +
      ")",
  );
  const nothing = ringState(["Event", "Event"]);
  driveWalk(nothing, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
    [/^Pass/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  ok(
    nothing.board.rings === 1 &&
      !nothing.ringUsedThisTurn &&
      nothing.dice.pool.every((pooled) => pooled.face === "Event"),
    "when no step is possible the ring is not used and every die keeps its face",
  );
}
// Rule 46: the minion box's ring does not make a Muster die to be set aside, and the Witch-king box's ring is used only
// if he can join or create a mobile Army.
function ringUsedOnlyWhereRule46Allows() {
  const trackedState = (setUp) => {
    const state = phase5State({
      dice: true,
      cards: false,
      tracker: true,
      wome: false,
    });
    state.board.rings = 1;
    state.dice.pool = [die("Event")];
    setUp(state);
    engine.startPhase(state, PHASE.P5);
    return state;
  };
  const minion = trackedState((state) => {
    state.board.nations.isengard = 0;
  });
  driveWalk(minion, [[/Will of the West die/, true]]);
  ok(
    minion.board.rings === 1 &&
      minion.dice.pool[0].face === "Event" &&
      minion.dice.pool[0].status !== DIE_STATE.RESERVED &&
      minion.walk.trail.some((entry) =>
        /would set the die aside/.test(entry.text),
      ),
    "no ring when the Muster page would set the die aside",
  );
  const witchKing = trackedState((state) => {
    state.board.chars.witchKing = MINION_STATUS.IN_PLAY;
  });
  driveWalk(witchKing, [
    [/^Witch-king is in play/, true],
    [/^Witch-king not in a/, false],
  ]);
  ok(
    witchKing.board.rings === 1 &&
      witchKing.dice.pool[0].face === "Event" &&
      witchKing.walk.trail.some((entry) =>
        /rule 46 does not allow it/.test(entry.text),
      ),
    "no ring for the Witch-king when he cannot join or create a mobile Army",
  );
}
// Corruption's "Mordor win" box: without the tracker the bold question keeps "Fellowship on the Mordor Track"; with it,
// and the Fellowship not on the Mordor Track, only the target part is asked.
function mordorWinRingPartAsksWholeBoldCondition() {
  const boldPrompt = (tracker) => {
    const state = phase5State({
      dice: false,
      cards: false,
      tracker,
      wome: false,
    });
    engine.startPhase(state, PHASE.P5);
    const seen = driveWalk(state, [
      [/^\*Mobile\* Army \*adjacent\* to \*target\*$/, true],
    ]);
    return seen.find((prompt) => /would win the game/.test(prompt.text));
  };
  const untracked = boldPrompt(false);
  ok(
    untracked?.bold &&
      /Fellowship on the Mordor Track/.test(untracked.text) &&
      /would win the game/.test(untracked.text),
    "tracker off: the bold question asks about the Mordor Track and the target's win",
  );
  const tracked = boldPrompt(true);
  ok(
    tracked?.bold && tracked.text === "*Target* would win the game",
    "tracker on, Fellowship not on the Mordor Track: the bold question asks about the target only",
  );
}
// Dice off: a No to "Does Queller have … die?" goes on to offer the ring, and a ring for a step that was not possible
// tells the player to turn the die back.
function diceOffRingOfferedAndTurnedBack() {
  const state = phase5State({
    dice: false,
    cards: false,
    tracker: true,
    wome: false,
  });
  state.board.rings = 1;
  engine.startPhase(state, PHASE.P5);
  const seen = driveWalk(state, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
    [/^Does Queller have/, false],
    byType(PROMPT.RING, true),
    [/Attack using Character/, "no"],
    [/Attack using Army/, "done"],
  ]);
  const ringAsks = seen.filter((prompt) => prompt?.type === PROMPT.RING).length;
  ok(
    ringAsks === 2 &&
      state.board.rings === 0 &&
      state.log.some((line) => /turn the die back/.test(line.text)),
    "the ring is offered at the first die question, and turned back when the Character attack was not possible",
  );
}
// Rules 43 and 46, review cases: a ring die spent at an "End action" box keeps the ring used; a die a page found nothing
// for is given back even with dice rolled; the attack box asks rule 46's question before a Character die; and a die
// that has been used never turns back.
function ringSettledWhereTheDieGoes() {
  const ringState = (strategy, faces) => {
    const state = phase5State(
      { dice: true, cards: false, tracker: false, wome: false },
      strategy,
    );
    state.board.rings = 1;
    state.dice.pool = faces.map((face) => die(face));
    engine.startPhase(state, PHASE.P5);
    return state;
  };
  const witchKing = ringState(STRATEGY.CORRUPTION, ["Event", "Event"]);
  driveWalk(witchKing, [
    [/^Witch-king is in play/, true],
    [/^Nazgûl or Witch-king in play$/, true],
    [/^Witch-king not in a/, true],
    [/^Mustered Witch-king$/, true],
  ]);
  ok(
    witchKing.walk.result === WALK_RESULT.ACTION &&
      witchKing.board.rings === 0 &&
      witchKing.ringUsedThisTurn &&
      !witchKing.walk.trail.some((entry) => /not used/.test(entry.text)),
    "the ring that made the Witch-king's Character die stands after “End action”",
  );
  const nothing = ringState(STRATEGY.CORRUPTION, ["Muster", "Muster"]);
  driveWalk(nothing, [
    [/^Character cards > 0 and ANY condition true:/, true],
    [/^Pass/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  // each ring die comes back before the walk leaves the bold box's steps (the walk later goes on to the rule 44 Elven
  // Ring search, which may use the ring again)
  const trailIndex = (pattern) =>
    nothing.walk.trail.findIndex((entry) => pattern.test(entry.text));
  const nextBox = trailIndex(/^Fellowship in region which Nazgûl can move to/);
  ok(
    trailIndex(/^Elven Ring not used for a Character die/) > -1 &&
      trailIndex(/^Elven Ring not used for an Event die/) > -1 &&
      trailIndex(/^Elven Ring not used for an Event die/) < nextBox,
    "the Character die and then the Event die a page found nothing for are given back",
  );
  const attack = (hasNazgul) => {
    const state = ringState(STRATEGY.MILITARY, ["Event", "Event"]);
    const seen = driveWalk(state, [
      [/^\*Mobile\* Army \*adjacent\* to \*target\* or an Army/, true],
      [/^ANY condition true:/, true],
      [/contain a Nazgûl or a minion/, hasNazgul],
      [/can move or attack towards closest/, true],
      [/^Move\/Attack$/, "done"],
    ]);
    return { state, seen };
  };
  const withNazgul = attack(true),
    withoutNazgul = attack(false);
  const facesUsed = (state) =>
    state.dice.pool
      .filter((pooled) => pooled.status === DIE_STATE.USED)
      .map((pooled) => pooled.face);
  ok(
    withNazgul.seen.some((prompt) =>
      /Nazgûl or a minion/.test(prompt?.text || ""),
    ) &&
      facesUsed(withNazgul.state).join() === "Character" &&
      facesUsed(withoutNazgul.state).join() === "Army",
    "the attack box's ring makes a Character die only for an Army with a Nazgûl or a minion, otherwise an Army die",
  );
  // after Yes, the Character page finds nothing: rule 46 gives this Army a Character die, never an Army die
  const yesThenNothing = ringState(STRATEGY.MILITARY, ["Event", "Event"]);
  driveWalk(yesThenNothing, [
    [/^\*Mobile\* Army \*adjacent\* to \*target\* or an Army/, true],
    [/^ANY condition true:/, true],
    [/contain a Nazgûl or a minion/, true],
    [/^Pass/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  ok(
    !yesThenNothing.walk.trail.some((entry) =>
      /die changed to Army/.test(entry.text),
    ),
    "after Yes, no ring makes an Army die for the Army 4 step",
  );
  const threatOnly = ringState(STRATEGY.CORRUPTION, ["Event", "Event"]);
  driveWalk(threatOnly, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Threat\* is sieging/, true],
    [/^Pass/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  ok(
    !threatOnly.walk.trail.some(
      (entry) =>
        entry.kind === TRAIL.JUMP && /Character 3/.test(entry.text || ""),
    ),
    "the threat box's ring makes no die for “Character 3 / Muster Witch-king”, a step rule 46 does not list",
  );
  // the ring's Character die for "Move using Character die" is given back before the "Army" jump records the walk's
  // die, so the return from the Army page does not bring that die back as a Character die
  const givenBack = ringState(STRATEGY.CORRUPTION, ["Event", "Army"]);
  driveWalk(givenBack, [
    [/^Shadow under \*threat\*/, true],
    [/^Move can increase the \*value\*/, true],
    [/^Move using Character die$/, "no"],
    [/^\*Threat\* is sieging/, true],
    [/^Pass/, "no"],
    byType(PROMPT.ACTION, "no"),
  ]);
  ok(
    !givenBack.walk.trail.some(
      (entry) =>
        entry.kind === TRAIL.JUMP && /Character 3/.test(entry.text || ""),
    ),
    "a ring die given back does not come back with the return from the next page",
  );
  const marked = ringState(STRATEGY.CORRUPTION, ["Event", "Event"]);
  for (
    let guard = 0;
    guard < 10 && marked.walk.prompt?.type !== PROMPT.ACTION;
    guard++
  )
    engine.answer(marked, true);
  const ringDie = marked.dice.pool.find(
    (pooled) => pooled.face === "Character",
  );
  ringDie.status = DIE_STATE.USED;
  engine.abandonWalk(marked);
  ok(
    ringDie.face === "Character" && marked.board.rings === 0,
    "a ring die the player marked used does not turn back when the walk is dropped",
  );
}
// Rules 43 and 46, round 4: a ring die still held when the walk reaches the next bold box turns back there, so that box
// arms its own ring; and with dice off, a No to the ring offer for one of rule 46's two dice leaves the other.
function ringSettledAtTheNextBoldBox() {
  const held = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  held.board.rings = 1;
  held.dice.pool = ["Muster", "Muster", "Muster"].map((face) => die(face));
  engine.startPhase(held, PHASE.P5);
  const seen = driveWalk(held, [
    [/^Character cards > 0 and ANY condition true:/, true],
    [/^Holding a Character card that uses the term/, true],
    [/^Play card using/, "no"],
    [/^\*Mobile\* Army \*adjacent\* to \*target\* or an Army/, true],
    [/^ANY condition true:/, true],
    [/contain a Nazgûl or a minion/, true],
    [/can move or attack towards closest/, true],
    [/^Move\/Attack$/, "done"],
  ]);
  const trailIndex = (pattern) =>
    held.walk.trail.findIndex((entry) => pattern.test(entry.text));
  ok(
    trailIndex(/^Elven Ring not used for an Event die/) > -1 &&
      trailIndex(/^Elven Ring not used for an Event die/) <
        trailIndex(/^ANY condition true:/) &&
      seen.some((prompt) => /Nazgûl or a minion/.test(prompt?.text || "")),
    "the Event die a ring made for “Play card using Event die” turns back at the next bold box, which asks rule 46's question",
  );
  const declined = phase5State(
    { dice: false, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  declined.board.rings = 1;
  engine.startPhase(declined, PHASE.P5);
  const offers = driveWalk(declined, [
    [/^\*Mobile\* Army \*adjacent\* to \*target\* or an Army/, true],
    [/^ANY condition true:/, true],
    [/^Does Queller have/, false],
    byType(PROMPT.RING, false),
  ])
    .filter((prompt) => prompt?.type === PROMPT.RING)
    .map((prompt) => prompt.req);
  ok(
    declined.walk.done &&
      offers.includes(DIE_REQUIREMENT.CHARACTER) &&
      offers.includes(DIE_REQUIREMENT.ARMY),
    "dice off: after a No to the ring for a Character die, the attack box offers it for an Army die (" +
      offers.join() +
      ")",
  );
  // the rule 44 walk lets a ring make any die, but not one the player already turned the ring down for
  const search = phase5State(
    { dice: false, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  search.board.rings = 1;
  engine.startWalk(search, "M5", "Phase 5", { mode: "ringAny" });
  const searchOffers = driveWalk(search, [
    [/^\*Mobile\* Army \*adjacent\* to \*target\* or an Army/, true],
    [/^ANY condition true:/, true],
    [/^Does Queller have/, false],
    byType(PROMPT.RING, false),
  ])
    .filter((prompt) => prompt?.type === PROMPT.RING)
    .map((prompt) => prompt.req);
  ok(
    search.walk.done &&
      searchOffers.filter((req) => req === DIE_REQUIREMENT.CHARACTER).length ===
        1,
    "dice off, rule 44 walk: a No to the ring for a Character die is not asked again (" +
      searchOffers.join() +
      ")",
  );
}
// Round 6: a ring that changes the very die the walk still held (its step was not possible) does not hand that die back
// as its old type when the page it was changed for returns.
function ringChangedHeldDieIsNotRestored() {
  const state = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  state.board.rings = 1;
  state.dice.pool = [die("Character")];
  engine.startPhase(state, PHASE.P5);
  driveWalk(state, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, false],
    [/^Move can create \*mobile\* Army/, true],
    [/^Move using Character die$/, "no"],
    [/^\*Threat\* is sieging/, true],
    byType(PROMPT.ACTION, "done"),
  ]);
  const pooled = state.dice.pool[0];
  ok(
    state.board.rings === 1 &&
      !state.ringUsedThisTurn &&
      pooled.face === "Character",
    "the ring's Army die turns back to Character, and the ring is not used (rings " +
      state.board.rings +
      ", die " +
      pooled.face +
      "/" +
      pooled.status +
      ")",
  );
  // without a ring, a page that claims the same pool die for another requirement hands it back on return
  const kept = phase5State({
    dice: true,
    cards: false,
    tracker: false,
    wome: false,
  });
  kept.dice.pool = [die("Army/Muster")];
  let heldAtSiege = null;
  engine.startPhase(kept, PHASE.P5);
  driveWalk(kept, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
    [/^Attack using Army die$/, "no"],
    [/is valid for muster$/, true],
    [
      /^\*Threat\* is sieging/,
      () => {
        heldAtSiege = { die: kept.walk.die, dieIndex: kept.walk.dieIndex };
        return false;
      },
    ],
  ]);
  ok(
    heldAtSiege?.die === DIE_REQUIREMENT.ARMY && heldAtSiege.dieIndex === 0,
    "the Army die the walk held is held again after the Muster page returns (" +
      JSON.stringify(heldAtSiege) +
      ")",
  );
}
// A walk saved with revision 2's ring state takes revision 3's.
function ringStateFromRevision2Migrates() {
  const state = phase5State({ dice: true });
  engine.startPhase(state, PHASE.P5);
  const old = JSON.parse(JSON.stringify(state));
  old.walk.flowRev = 2;
  old.walk.ringArmed = true;
  delete old.walk.ringDice;
  delete old.walk.ringPending;
  const walk = engine.migrate(old).walk;
  ok(
    walk.flowRev === engine.FLOW_REV &&
      walk.ringDice === "any" &&
      !("ringArmed" in walk) &&
      walk.ringPending === null,
    "ringArmed becomes ringDice, with no ring use pending",
  );
}
// Rule 31 and the WoME rules: a Wild result on the Faction die recruits, plays or draws for the Factions; it is no Army,
// Muster, Character or Event die.
function wildResultOnlyForFactionSteps() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: true },
    STRATEGY.MILITARY,
  );
  state.dice.pool = [
    { kind: engine.DIE_KIND.FACTION, face: "Wild", status: DIE_STATE.AVAIL },
  ];
  const actionSteps = [
    DIE_REQUIREMENT.ARMY,
    DIE_REQUIREMENT.MUSTER,
    DIE_REQUIREMENT.CHARACTER,
    DIE_REQUIREMENT.EVENT,
    DIE_REQUIREMENT.CHAR_OR_MUSTER,
  ];
  const factionSteps = [
    DIE_REQUIREMENT.FACTION_RECRUIT,
    DIE_REQUIREMENT.FACTION_PLAY,
    DIE_REQUIREMENT.FACTION_DRAW,
  ];
  ok(
    actionSteps.every((req) => !engine.findDie(state, req)) &&
      factionSteps.every(
        (req) => engine.findDie(state, req) === state.dice.pool[0],
      ),
    "the Faction die's Wild result recruits, plays or draws for the Factions, and serves no Action step",
  );
  const diceOff = phase5State(
    { dice: false, cards: false, tracker: true, wome: true },
    STRATEGY.MILITARY,
  );
  engine.startPhase(diceOff, PHASE.P5);
  const factionQuestions = driveWalk(diceOff, [
    [/^All factions in play/, true],
    byType(PROMPT.ACTION, "no"),
  ]).filter(
    (prompt) =>
      prompt?.type === PROMPT.DIE_CHECK && /Faction/.test(prompt.text),
  );
  ok(
    factionQuestions.length > 0 &&
      factionQuestions.every((prompt) =>
        /a Wild result on the Faction die counts/.test(prompt.text),
      ),
    "dice off: the question for a Faction die says a Wild result counts",
  );
}
// WoME p.8: an Elven Ring cannot change the Faction die, and an Action die cannot act on Faction figures, so a ring
// never makes a die for a Faction step, with dice on or off.
function ringMakesNoFactionDie() {
  const ringSearch = (dice) => {
    const state = phase5State(
      { dice, cards: false, tracker: dice, wome: true },
      STRATEGY.MILITARY,
    );
    state.board.rings = 1;
    if (dice) state.dice.pool = [die("Eye")];
    engine.startWalk(state, "M5", "Phase 5", { mode: "ringAny" });
    return state;
  };
  const factionFaces = new Set([
    "Wild",
    DIE_REQUIREMENT.FACTION_RECRUIT,
    DIE_REQUIREMENT.FACTION_PLAY,
    DIE_REQUIREMENT.FACTION_DRAW,
  ]);
  const diceOn = ringSearch(true);
  driveWalk(diceOn, [byType(PROMPT.ACTION, "no")]);
  ok(
    !diceOn.log.some((entry) => {
      const changed = /Elven Ring: changed a \w+ die to (\w+)/.exec(entry.text);
      return changed && factionFaces.has(changed[1]);
    }),
    "dice on: the rule 44 walk never changes a die for a Faction step",
  );
  const direct = ringSearch(true);
  ok(
    engine.ringChange(direct, DIE_REQUIREMENT.FACTION_RECRUIT) === null &&
      direct.board.rings === 1 &&
      direct.dice.pool[0].face === "Eye",
    "dice on: ringChange makes no Faction die and keeps the ring",
  );
  const diceOff = ringSearch(false);
  const factionOffers = driveWalk(diceOff, [
    byType(PROMPT.ACTION, "no"),
    byType(PROMPT.RING, false),
  ]).filter(
    (prompt) =>
      prompt?.type === PROMPT.RING && engine.isFactionRequirement(prompt.req),
  );
  ok(
    diceOff.walk.done && factionOffers.length === 0,
    "dice off: the rule 44 walk offers no ring for a Faction step",
  );
  // a save from before this fix may hold a ring offer for a Faction step: a Yes to it uses no ring
  const restored = ringSearch(false);
  driveWalk(restored, [
    byType(PROMPT.ACTION, "no"),
    {
      test: (prompt) =>
        prompt.type === PROMPT.DIE_CHECK &&
        prompt.req === DIE_REQUIREMENT.FACTION_PLAY,
      answer: (prompt) => {
        restored.walk.prompt = {
          type: PROMPT.RING,
          req: prompt.req,
          label: prompt.label,
          text: "Use an Elven Ring",
        };
        return true;
      },
    },
  ]);
  ok(
    restored.walk.done &&
      restored.board.rings === 1 &&
      !restored.ringUsedThisTurn &&
      restored.log.some((entry) =>
        /cannot make a Faction die/.test(entry.text),
      ),
    "dice off: a Yes to a saved ring offer for a Faction step uses no ring",
  );
}
// Rule 30, Messenger of the Dark Tower: with the Mouth of Sauron in play and no Army or Army/Muster die, a Muster die
// acts as an Army die, once per turn; a step that turns out not possible does not use the ability.
function messengerMusterDieActsAsArmyOncePerTurn() {
  const state = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  state.board.chars.mouth = MINION_STATUS.IN_PLAY;
  state.dice.pool = [die("Muster"), die("Muster")];
  const attackThreat = (attack) =>
    driveWalk(state, [
      [/^Shadow under \*threat\*/, true],
      [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
      [/Attack using Army/, attack],
      [/^Pass/, "no"],
      byType(PROMPT.ACTION, "no"),
    ]);
  engine.startPhase(state, PHASE.P5);
  const firstTry = attackThreat("no");
  const offeredThenNotPossible =
    firstTry.some((prompt) => /Attack using Army/.test(prompt?.text || "")) &&
    !state.messengerUsedThisTurn;
  // the first walk found no action and set a die aside (rule 39); the attack spends exactly one more
  const usedDice = () =>
    state.dice.pool.filter((pooled) => pooled.status === DIE_STATE.USED).length;
  const usedBefore = usedDice();
  engine.startPhase(state, PHASE.P5);
  attackThreat("done");
  const usedOnce = state.messengerUsedThisTurn && usedDice() === usedBefore + 1;
  engine.startPhase(state, PHASE.P5);
  const third = attackThreat("done");
  ok(
    offeredThenNotPossible &&
      usedOnce &&
      !third.some((prompt) => /Attack using Army/.test(prompt?.text || "")),
    "a Muster die attacks as an Army die once; Not possible does not use the ability; the second time it is not offered",
  );
  engine.nextTurn(state);
  ok(!state.messengerUsedThisTurn, "the next turn makes it available again");
  // the Army attack claims the Muster die through Messenger and is not possible; the Muster page then spends that die
  // as a Muster die, which uses no Messenger
  const musterAfter = phase5State(
    { dice: true, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  musterAfter.board.chars.mouth = MINION_STATUS.IN_PLAY;
  musterAfter.dice.pool = [die("Muster")];
  engine.startPhase(musterAfter, PHASE.P5);
  driveWalk(musterAfter, [
    [/^Shadow under \*threat\*/, true],
    [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
    [/^Attack using Army die$/, "no"],
    [/is valid for muster$/, true],
    [/able to muster$/, true],
    byType(PROMPT.ACTION, "done"),
  ]);
  ok(
    musterAfter.dice.pool[0].status === DIE_STATE.USED &&
      !musterAfter.messengerUsedThisTurn,
    "a Muster die given up as an Army die and then spent as a Muster die uses no Messenger",
  );
  // dice off: after a No to the Army die, Messenger is its own question; a Yes and the attack use it for the turn
  const diceOff = phase5State(
    { dice: false, cards: false, tracker: true, wome: false },
    STRATEGY.MILITARY,
  );
  diceOff.board.chars.mouth = MINION_STATUS.IN_PLAY;
  const messengerAsks = (attack) => {
    engine.startPhase(diceOff, PHASE.P5);
    return driveWalk(diceOff, [
      [/^Shadow under \*threat\*/, true],
      [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
      [/^Does Queller have a Muster die to use as an Army die/, true],
      [/^Does Queller have/, false],
      [/^Attack using Army die$/, attack],
      [/^Pass/, "no"],
      byType(PROMPT.ACTION, "no"),
    ]).filter((prompt) => prompt?.messenger).length;
  };
  const firstAsks = messengerAsks("done");
  const usedOff = diceOff.messengerUsedThisTurn;
  const secondAsks = messengerAsks("done");
  ok(
    firstAsks === 1 && usedOff && secondAsks === 0,
    "dice off: the Messenger question comes after a No to the Army die, and once used it is not asked again that turn",
  );
}
// Rule 9: an Army die moves two different Armies. After the first move the Army page is walked again from the same start
// point; the die is spent after the second move, or when the second walk finds none. An attack uses the whole die, and a
// Character die makes one move.
function armyDieMovesTwoArmies() {
  const armyWalk = (face, req, rules, start = "Army 4") => {
    const state = phase5State(
      { dice: true, cards: false, tracker: false, wome: false },
      STRATEGY.MILITARY,
    );
    state.dice.pool = [die(face)];
    engine.startWalk(state, "AR", start, { die: req, dieIndex: 0 });
    const seen = driveWalk(state, rules);
    const moveAsks = seen.filter((prompt) => prompt?.text === "Move/Attack");
    return { state, moveAsks };
  };
  const toMove = [/can move or attack towards closest/, true];
  const twice = armyWalk("Army", DIE_REQUIREMENT.ARMY, [
    toMove,
    [/^Move\/Attack$/, "done"],
  ]);
  ok(
    twice.moveAsks.length === 2 &&
      twice.moveAsks[0].moveOrAttack &&
      twice.state.dice.pool[0].status === DIE_STATE.USED &&
      twice.state.walk.result === WALK_RESULT.ACTION &&
      twice.state.walk.trail.some((entry) =>
        /Second Army move: “Army 4”/.test(entry.text),
      ),
    "after the first move the Army page is walked again from “Army 4”; the die is spent after the second",
  );
  const attacked = armyWalk("Army", DIE_REQUIREMENT.ARMY, [
    toMove,
    [/^Move\/Attack$/, "attacked"],
  ]);
  ok(
    attacked.moveAsks.length === 1 &&
      attacked.state.dice.pool[0].status === DIE_STATE.USED,
    "an attack uses the whole die",
  );
  let firstWalk = true;
  const noSecond = armyWalk("Army", DIE_REQUIREMENT.ARMY, [
    {
      test: (prompt) => /can move or attack towards closest/.test(prompt.text),
      answer: () => {
        const answer = firstWalk;
        firstWalk = false;
        return answer;
      },
    },
    [/^Move\/Attack$/, "done"],
  ]);
  ok(
    noSecond.moveAsks.length === 1 &&
      noSecond.state.dice.pool[0].status === DIE_STATE.USED &&
      noSecond.state.walk.result === WALK_RESULT.ACTION &&
      /No second Army move/.test(lastLogText(noSecond.state)),
    "when the second walk finds no move, the die is spent",
  );
  const character = armyWalk("Character", DIE_REQUIREMENT.CHARACTER, [
    toMove,
    [/^Move\/Attack$/, "done"],
  ]);
  ok(
    character.moveAsks.length === 1 && !character.moveAsks[0].moveOrAttack,
    "a Character die makes one move",
  );
  const second = armyWalk("Army", DIE_REQUIREMENT.ARMY, [
    toMove,
    [/^Move\/Attack$/, "done"],
  ]);
  ok(
    second.moveAsks.length === 2 &&
      second.moveAsks[0].armyMove &&
      !second.moveAsks[1].armyMove &&
      !second.moveAsks[1].moveOrAttack &&
      second.state.log.some((entry) =>
        /^Queller: Move\/Attack \(first Army move\)\.$/.test(entry.text),
      ),
    "the second move offers neither another first move nor an attack, and the log names the first move",
  );
  const both = armyWalk("Army", DIE_REQUIREMENT.ARMY, [
    toMove,
    [/^Move\/Attack$/, "movedBoth"],
  ]);
  ok(
    both.moveAsks.length === 1 &&
      both.state.dice.pool[0].status === DIE_STATE.USED &&
      both.state.walk.result === WALK_RESULT.ACTION &&
      both.state.walk.trail.some(
        (entry) => entry.answer === "moved two Armies",
      ),
    "“Moved two Armies” uses the die without a second walk",
  );
  // the first walk moves; the second finds a threat with an adjacent mobile Army, and skips the attack
  let walkNumber = 0;
  const secondWalkActions = [];
  const noAttack = armyWalk(
    "Army",
    DIE_REQUIREMENT.ARMY,
    [
      {
        test: (prompt) => /^\*Threat\* exists$/.test(prompt.text),
        answer: () => ++walkNumber > 1,
      },
      [/^\*Mobile\* Army \*adjacent\* to \*threat\*$/, true],
      {
        test: (prompt) => prompt.type === PROMPT.ACTION,
        answer: (prompt) => {
          if (walkNumber > 1) secondWalkActions.push(prompt.text);
          return walkNumber > 1 ? "no" : "done";
        },
      },
      toMove,
    ],
    "Army",
  );
  ok(
    walkNumber === 2 &&
      !secondWalkActions.includes("Attack") &&
      noAttack.state.walk.trail.some(
        (entry) =>
          entry.kind === TRAIL.SKIP &&
          entry.text === "Attack" &&
          /rule 9/.test(entry.why || ""),
      ),
    "on the second walk an Attack box is skipped: the die's second use is a move (" +
      secondWalkActions.join() +
      ")",
  );
  // after the first move the die has acted, so it cannot pay to remove a Free Peoples card (rule 19)
  const moved = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  moved.dice.pool = [die("Army")];
  engine.startWalk(moved, "AR", "Army 4", {
    die: DIE_REQUIREMENT.ARMY,
    dieIndex: 0,
  });
  for (let guard = 0; guard < 20 && !moved.walk.armyMoves; guard++)
    engine.answer(
      moved,
      moved.walk.prompt.type === PROMPT.YES_NO ? true : "done",
    );

  ok(
    moved.walk.armyMoves === 1 && moved.walk.dieUsed === true,
    "the first Army move marks the die used, so a blocked second move cannot pay with it",
  );
}
// Rule 11: with no Army or Army/Muster die, the move towards an exposed target uses a Character die when the Army
// that moves contains a Nazgûl or a minion.
function exposedMoveFallsBackToCharacterDie() {
  const exposedWalk = (
    hasNazgul,
    settings = { dice: true },
    setUp = () => {},
  ) => {
    const state = phase5State(
      { cards: false, tracker: false, wome: false, ...settings },
      STRATEGY.MILITARY,
    );
    state.dice.pool = [die("Character")];
    setUp(state);
    engine.startPhase(state, PHASE.P5);
    const seen = driveWalk(state, [
      [/^Shadow under \*threat\*/, true],
      [/^Can move towards \*exposed\*$/, true],
      [/contain a Nazgûl or a minion/, hasNazgul],
      // the threat moves are not for the Character die: this Yes must never be asked
      [/^\*Threat\* exists$/, true],
      [/^\*Exposed\* \*target\* exists$/, true],
      [/^Does Queller have an Army die/, false],
      [/^Does Queller have a Character die/, true],
      [/^Move nearest Army towards/, "done"],
      [/^Pass/, "no"],
      byType(PROMPT.ACTION, "no"),
    ]);
    return { state, seen };
  };
  const characterJump = (state) =>
    state.walk.trail.some(
      (entry) =>
        entry.kind === TRAIL.JUMP &&
        entry.text === "Army" &&
        entry.die === "Character",
    );
  const yes = exposedWalk(true);
  ok(
    yes.seen.some((prompt) =>
      /^Move nearest Army towards/.test(prompt?.text || ""),
    ) &&
      yes.state.dice.pool[0].status === DIE_STATE.USED &&
      yes.state.walk.result === WALK_RESULT.ACTION &&
      !yes.seen.some((prompt) => /^\*Threat\* exists$/.test(prompt?.text)) &&
      yes.state.walk.trail.some(
        (entry) =>
          /^\*Threat\* exists$/.test(entry.text) &&
          entry.answer === "No" &&
          /rule 11/.test(entry.why || ""),
      ),
    "with a Nazgûl or minion in the Army, the Character die makes the move towards exposed and none of the threat moves",
  );
  const no = exposedWalk(false);
  ok(
    !no.seen.some((prompt) =>
      /^Move nearest Army towards/.test(prompt?.text || ""),
    ) && !characterJump(no.state),
    "without one, the Character die is not taken for the move",
  );
  const diceOff = exposedWalk(true, { dice: false });
  ok(
    diceOff.seen.some((prompt) =>
      /^Move nearest Army towards/.test(prompt?.text || ""),
    ) &&
      characterJump(diceOff.state) &&
      diceOff.seen.some((prompt) =>
        /^Does Queller have a Character die/.test(prompt?.text || ""),
      ),
    "dice off: after No to the Army die, the same question claims a Character die for the move",
  );
  const noNazgul = exposedWalk(true, { dice: true, tracker: true }, (state) => {
    state.board.nazgul = 0;
    for (const minion of ["witchKing", "mouth", "saruman"])
      state.board.chars[minion] = MINION_STATUS.AVAILABLE;
  });
  ok(
    !noNazgul.seen.some((prompt) =>
      /contain a Nazgûl or a minion/.test(prompt?.text || ""),
    ) && !characterJump(noNazgul.state),
    "with the tracker showing no Nazgûl and no minion in play, the question is not asked",
  );
}
// A walk started from the Jump modal with a die (no pool index) holds a matching pool die and spends it; with no
// matching die it holds none.
function jumpModalDieComesFromThePool() {
  const withDie = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  withDie.dice.pool = [die("Event"), die("Army/Muster")];
  engine.startWalk(withDie, "AR", "Army", { die: DIE_REQUIREMENT.ARMY });
  const heldIndex = withDie.walk.dieIndex;
  driveWalk(withDie, [[/can move or attack towards closest/, true]]);
  ok(
    heldIndex === 1 &&
      withDie.walk.result === WALK_RESULT.ACTION &&
      withDie.dice.pool[1].status === DIE_STATE.USED &&
      withDie.dice.pool[0].status === DIE_STATE.AVAIL,
    "the Army die picked in the Jump modal is the pool's Army/Muster die, and the action spends it (" +
      withDie.dice.pool[1].status +
      ")",
  );
  const noMatch = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  noMatch.dice.pool = [die("Event")];
  engine.startWalk(noMatch, "AR", "Army", { die: DIE_REQUIREMENT.ARMY });
  ok(
    noMatch.walk.die === null &&
      noMatch.walk.dieIndex === null &&
      noMatch.log.some((entry) =>
        /no Army die in the pool: the walk starts without one/.test(entry.text),
      ),
    "with no matching die in the pool the walk starts without one, and the log says so",
  );
}
// A walk started from the Jump modal holds no die: "Using a Character die and …" asks only about the die and checks the
// cards from the hand, and "Muster 3" claims a Muster die from the pool instead of carrying a die it does not hold.
function walkWithoutADie() {
  const event = phase5State(
    { dice: true, cards: true, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  engine.startWalk(event, "EV", "Event", {});
  const asked = driveWalk(event, [
    [/^Is Queller using a Character die$/, true],
  ]).map((prompt) => prompt?.text || "");
  ok(
    asked.includes("Is Queller using a Character die") &&
      !asked.some((text) =>
        /holding a \*playable\* Character card/.test(text),
      ) &&
      event.walk.trail.some(
        (entry) =>
          /^Using a Character die and holding/.test(entry.text) &&
          entry.answer === "No",
      ),
    "the Event page asks only whether Queller uses a Character die, and answers the card part from the empty hand",
  );
  const army = phase5State(
    { dice: true, cards: false, tracker: false, wome: false },
    STRATEGY.MILITARY,
  );
  army.dice.pool = [die("Muster")];
  engine.startWalk(army, "AR", "Army", {});
  driveWalk(army, [
    [/^Using an Army\/Muster die$/, true],
    [/^Shadow is able to muster$/, true],
  ]);
  ok(
    army.walk.result === WALK_RESULT.ACTION &&
      army.dice.pool[0].status === DIE_STATE.USED,
    "“Muster 3” with no die held claims and spends the pool's Muster die (" +
      army.dice.pool[0].status +
      ")",
  );
}
// The scenarios, with the section of the change log each one guards.
const SCENARIOS = [
  ["7.1", reservedMusterDieIsUsedOrSpent],
  ["7.1", twoReservedDiceBothUsed],
  ["7.2", musterDieAskedAgainAfterReserve],
  ["7.2", reservedDieIsNotSpentAsArmyDie],
  ["ring", ringUsedOnceOnlyWhenHeld],
  ["6.1", militaryPhase5PlaysRevealedCardAndPalantirDraws],
  ["6.2", balrogOnTableOfferedAsDurinsBane],
  ["6.3", actionsUpdateTheTracker],
  ["faction", recruitCardKeepsFactionOutOfPlay],
  ["6.4", lidlessEyeMovesDiceNotItsOwn],
  ["6.4", lidlessEyeTopsUpToThree],
  ["6.5", huntMinimumAskedOnZeroDicePaths],
  ["6.5", rule34CapsHuntAllocations],
  ["6.6", tableTriggersDiscardOrAsk],
  ["6.6", threatsAndPromisesAsksOnActivation],
  ["6.6", declaringTheFellowshipAsksAboutTableCards],
  ["6.7", callToBattleCardsIgnoreInitiative],
  ["7.3/7.4", battleOpenResetAndRunGuard],
  ["7.3/7.4", sideWalkKeepsTheBattleOpen],
  ["ui", openingJumpAddsNoUndoStep],
  ["ui", battleDraftSurvivesRendersNotANewGame],
  ["migrate", migrateUpgradesOldSaves],
  ["migrate", womeDecksLeaveOutReplacedCards],
  ["decks", emptyEventDecksFallBack],
  ["decks", drawStepWithNoCardKeepsTheDie],
  ["faction", servantsOfSauronCannotDrawItself],
  ["faction", factionDeckReshuffledWhenItRunsOut],
  ["faction", factionCardsNeedTheirFaction],
  ["faction", palantirDrawsAfterAFactionCard],
  ["faction", palantirDrawAboveTheHandLimitDiscards],
  ["dice", wildResultOnlyForFactionSteps],
  ["dice", ringMakesNoFactionDie],
  ["dice", messengerMusterDieActsAsArmyOncePerTurn],
  ["army", armyDieMovesTwoArmies],
  ["army", exposedMoveFallsBackToCharacterDie],
  ["6.6", wornWithSorrowAsksAndWormtongueOnSaruman],
  ["7.1", reservedDieCannotBeReservedAgain],
  ["muster", musterChoiceCardAutoAnswered],
  ["muster", mouthOfSauronNeedsFreePeoplesAtWarOrMordor],
  ["muster", eliminatedMinionIsNeverMusteredAgain],
  ["fp", forcedDiscardPaysArmyCharacterAndActionDie],
  ["draft", discardLoopDiscardsOneCardAtATime],
  ["draft", armyMusterDieTriesMuster3First],
  ["draft", retreatedDefenderSendsQuellerToAdvance],
  ["draft", secondAttackingQuestionReusesTheRound],
  ["draft", noSetAsideDieFallsThroughToDiscard],
  ["draft", eventPageChecksTheDie],
  ["migrate", savedWalkFromReleasedFlowchartResumes],
  ["migrate", version61ArmyWalkResumesAndEnds],
  ["migrate", version61ArmyMovePromptGetsBothMoves],
  ["migrate", migratedWalkHasEveryField],
  ["migrate", migratedArmyStartForEveryArmyJump],
  ["draft", reservedDieSpentBeforeDiscardingAnother],
  ["draft", reservedDieSpentWithDiceOff],
  ["calc", captainOfTheWestCountsOnce],
  ["rings", ringReturnedWhenItsStepIsNotPossible],
  ["rings", ringUsedOnlyWhereRule46Allows],
  ["rings", mordorWinRingPartAsksWholeBoldCondition],
  ["rings", diceOffRingOfferedAndTurnedBack],
  ["rings", ringSettledWhereTheDieGoes],
  ["rings", ringSettledAtTheNextBoldBox],
  ["rings", ringChangedHeldDieIsNotRestored],
  ["migrate", ringStateFromRevision2Migrates],
  ["draft", jumpModalDieComesFromThePool],
  ["draft", walkWithoutADie],
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
