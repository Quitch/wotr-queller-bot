// ===== Flowchart walk engine =====
(function () {
  const engine = window.QB,
    FLOW = window.QB_FLOW,
    NODE = window.QB_NODE,
    NODE_KIND = window.QB_NODE_KIND,
    EDGE = window.QB_EDGE,
    cardById = engine.cardById;
  const {
    DECK,
    HAND,
    DIE_KIND,
    STRATEGY,
    PHASE,
    CARD,
    DIE_REQUIREMENT,
    TRAIL,
  } = engine;
  const SHADOW_NATION_NAME = {
      sauron: "Sauron",
      isengard: "Isengard",
      se: "Southrons and Easterlings",
    },
    SHADOW_NATION_KEY = {
      Sauron: "sauron",
      Isengard: "isengard",
      "Southrons and Easterlings": "se",
    };
  // Returned by a handler that has set a prompt and is waiting for the player; only ever compared with ===.
  const PENDING = Symbol("prompt open");
  // What the walk is asking the player (walk.prompt.type).
  const PROMPT = {
    YES_NO: "yesno",
    COUNT: "count",
    SITUATIONAL: "situ",
    CONFIRM: "confirm",
    DIE_CHECK: "diecheck",
    RING: "ring",
    ACTION: "action",
    STEP: "step",
    ROLL: "roll",
    PLAY_CARD: "playcard",
    CHOICE: "choice",
    PRIORITY: "priority",
    BATTLE_FORM: "battleForm",
  };
  // The prompts answered with yes or no.
  const YES_NO_PROMPTS = [
    PROMPT.YES_NO,
    PROMPT.SITUATIONAL,
    PROMPT.CONFIRM,
    PROMPT.DIE_CHECK,
    PROMPT.RING,
  ];
  // How a walk ended (walk.result); a walk that reached another start point ends with phaseResult(name).
  const WALK_RESULT = {
    ACTION: "action",
    PASS: "pass",
    NO_ACTION: "noaction",
    STRATEGY: "strategy",
    BATTLE_NEXT: "battleNext",
    END: "end",
  };
  const PHASE_RESULT_PREFIX = "phase:";
  const phaseResult = (startName) => PHASE_RESULT_PREFIX + startName;
  // The start point a walk ended at, or null for any other result.
  const phaseFromResult = (result) =>
    typeof result === "string" && result.startsWith(PHASE_RESULT_PREFIX)
      ? result.slice(PHASE_RESULT_PREFIX.length)
      : null;
  // The strategy roll: 1-3 corruption, 4-6 military.
  const STRATEGY_ROLL = { LOW: "1-3", HIGH: "4-6" };
  const isLowRoll = (roll) => roll <= 3;
  // The priority-list boxes whose items are card criteria (check.js verifies the engine understands every item).
  const CARD_CRITERIA_NODES = [
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
  const DIE_REQUIREMENT_NAME = {
    [DIE_REQUIREMENT.ARMY]: "Army",
    [DIE_REQUIREMENT.MUSTER]: "Muster",
    [DIE_REQUIREMENT.CHARACTER]: "Character",
    [DIE_REQUIREMENT.EVENT]: "Event",
    [DIE_REQUIREMENT.CHAR_OR_MUSTER]: "Character or Muster",
    [DIE_REQUIREMENT.FACTION_RECRUIT]: "Faction (Recruit)",
    [DIE_REQUIREMENT.FACTION_PLAY]: "Faction (Play)",
    [DIE_REQUIREMENT.FACTION_DRAW]: "Faction (Draw)",
  };
  function dieWithArticle(requirement) {
    const name = DIE_REQUIREMENT_NAME[requirement] || requirement;
    return (/^[AEIOU]/.test(name) ? "an " : "a ") + name;
  }
  function normalizeText(text) {
    return text.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();
  }
  function jumpSpec(boxText) {
    const label = normalizeText(boxText);
    for (const [pattern, spec] of JUMPS) if (pattern.test(label)) return spec;
    return null;
  }
  function outEdges(page, id) {
    return FLOW[page].edges.filter((edge) => EDGE.from(edge) === id);
  }
  function edgeFor(page, id, label) {
    const edges = outEdges(page, id);
    let edge = edges.find((candidate) => EDGE.label(candidate) === label);
    if (!edge) edge = edges.find((candidate) => EDGE.label(candidate) == null);
    return edge;
  }
  function findStart(page, name) {
    const nodes = FLOW[page].nodes;
    for (const id in nodes) {
      if (
        NODE.kind(nodes[id]) === NODE_KIND.START &&
        normalizeText(NODE.text(nodes[id])) === normalizeText(name)
      )
        return id;
    }
    return null;
  }

  // Create the walk at a start point without stepping it; returns false when the start point does not exist.
  function beginWalk(state, page, startName, options = {}) {
    const id = findStart(page, startName);
    if (!id) {
      engine.log(
        state,
        "No start point “" + startName + "” on " + FLOW[page].name,
      );
      return false;
    }
    state.walk = {
      page,
      node: id,
      entry: { page, start: startName },
      stack: [],
      trail: [],
      prompt: null,
      done: false,
      result: null,
      die: options.die || null,
      dieObj: options.dieObj != null ? options.dieObj : null,
      dieAns: {},
      dieUsed: false,
      pendingDie: null, // the die this walk holds; dieAns/pendingDie: the player's die answers when dice are not rolled
      mode: options.mode || null,
      ringArmed: false,
      ringAsked: false, // Elven Ring state (rules 36–38)
      battleRound: options.battleRound || null,
      fromReserve: false,
      reserveDieObj: null, // set when "Use Muster die set aside for minion" re-enters Muster 2
      cands: null,
      chosen: null,
      steps: null,
      ctb: null,
      discards: null, // card candidates and the priority-list result
      nationChoice: null,
      factionChoice: null,
      minionPick: null, // results of the Muster/Faction priority lists
      sub: 0,
      parts: {},
    }; // multi-part decisions and answers to board questions
    trail(state, { kind: TRAIL.START, text: startName, page });
    engine.log(
      state,
      "Walk: " +
        FLOW[page].name +
        " from “" +
        normalizeText(startName) +
        "”" +
        (options.mode === "ringAny"
          ? " (looking for a ring use, rule 37)"
          : "") +
        ".",
    );
    return true;
  }
  function startWalk(state, page, startName, options) {
    if (beginWalk(state, page, startName, options)) run(state);
  }
  function trail(state, entry) {
    entry.page = entry.page || state.walk.page;
    entry.node = entry.node || state.walk.node;
    state.walk.trail.push(entry);
  }
  function cur(state) {
    return FLOW[state.walk.page].nodes[state.walk.node];
  }
  function goto(state, page, id) {
    state.walk.page = page;
    state.walk.node = id;
  }
  function follow(state, label) {
    const walk = state.walk;
    const edge = edgeFor(walk.page, walk.node, label);
    if (!edge) return false;
    goto(state, walk.page, EDGE.to(edge));
    return true;
  }
  function endWalk(state, result, message) {
    const walk = state.walk;
    walk.done = true;
    walk.result = result;
    walk.prompt = null;
    trail(state, { kind: TRAIL.END, text: message || result });
    if (message) engine.log(state, message);
  }
  function setPrompt(state, prompt) {
    state.walk.prompt = prompt;
  }

  // --- main loop ---
  const RUN_GUARD = 300;
  // A start box: the walk's own start point is passed through; any other start point reached is where the walk ends (the next phase).
  function atStart(state, walk, node) {
    const first = walk.trail[0];
    if (first.page === walk.page && first.node === walk.node)
      follow(state, null);
    else
      endWalk(
        state,
        phaseResult(normalizeText(NODE.text(node))),
        "Reached “" + normalizeText(NODE.text(node)) + "”.",
      );
  }
  // The handler for each box kind (see flow.js); notes are passed through.
  const STEP = {
    [NODE_KIND.START]: atStart,
    [NODE_KIND.NOTE]: (state) => follow(state, null),
    [NODE_KIND.DECISION]: (state, walk, node) => handleDecision(state, node),
    [NODE_KIND.FOLLOW_UP]: (state, walk, node) => handleDecision(state, node),
    [NODE_KIND.JUMP]: (state, walk, node) => handleJump(state, node),
    [NODE_KIND.ACTION]: (state, walk, node) => handleAction(state, node),
    [NODE_KIND.STEP]: (state, walk, node) => handleStep(state, node),
    [NODE_KIND.PRIORITY]: (state, walk, node) => handlePriority(state, node),
  };
  function run(state) {
    let guard = 0;
    while (state.walk && !state.walk.done && !state.walk.prompt) {
      if (guard++ >= RUN_GUARD) {
        endWalk(
          state,
          WALK_RESULT.NO_ACTION,
          "The walk did not finish (more than " +
            RUN_GUARD +
            " steps) — walk again.",
        );
        break;
      }
      const walk = state.walk,
        node = cur(state),
        boxKind = NODE.kind(node);
      if (!STEP[boxKind]) {
        endWalk(
          state,
          WALK_RESULT.NO_ACTION,
          "Unknown box kind “" + boxKind + "”.",
        );
        break;
      }
      STEP[boxKind](state, walk, node);
    }
  }
  // Board consequences of a decision the player answered (the tracker keeps up with what the flowchart just established).
  const DECIDE_HOOKS = {
    "CH.musteredWK": (state, answer) => {
      if (answer && !state.board.chars.witchKing) {
        state.board.chars.witchKing = true;
        state.playable = {};
        engine.log(
          state,
          "Witch King is now in play (tracker updated; his die joins the pool next turn).",
        );
      }
    },
  };
  // Record a decision (`text` as shown; `ringCondition` when the question is an Elven Ring condition) and follow its Yes/No arrow.
  function recordDecision(
    state,
    { text: question, ringCondition, answer, auto: automatic, why },
  ) {
    const walk = state.walk;
    trail(state, {
      kind: TRAIL.QUESTION,
      text: question,
      answer: answer ? "Yes" : "No",
      auto: !!automatic,
      why,
      ring: !!ringCondition,
    });
    if (answer && ringCondition && !state.ringUsedThisTurn)
      walk.ringArmed = true;
    const hook = DECIDE_HOOKS[walk.page + "." + walk.node];
    if (hook) hook(state, answer);
    walk.sub = 0;
    walk.parts = {};
    if (!follow(state, answer ? "Yes" : "No")) {
      endWalk(
        state,
        WALK_RESULT.NO_ACTION,
        "The flowchart has no arrow for that answer.",
      );
    }
  }
  function ask(state, node, question, promptExtra) {
    setPrompt(state, {
      type: PROMPT.YES_NO,
      text: question || NODE.text(node),
      node: state.walk.node,
      page: state.walk.page,
      kind: NODE.kind(node),
      ...promptExtra,
    });
  }
  // A yes/no board fact: from the tracker when it is on, otherwise asked of the player once per node (answers live in walk.parts). Returns PENDING while the question is open.
  function boardFactYesNo(state, factKey, question, trackerValue) {
    if (state.settings.tracker) return trackerValue;
    const walk = state.walk,
      partKey = walk.page + "." + walk.node + "." + factKey;
    if (partKey in walk.parts) return walk.parts[partKey];
    setPrompt(state, {
      type: PROMPT.YES_NO,
      text: question,
      part: partKey,
      node: walk.node,
      page: walk.page,
      kind: NODE_KIND.FOLLOW_UP,
      board: true,
    });
    return PENDING;
  }

  // ----- decisions -----
  // Record an automatic answer to the current decision box and follow its arrow.
  function answerAuto(state, node, answer, why) {
    recordDecision(state, {
      text: NODE.text(node),
      ringCondition: NODE.extra(node).bold,
      answer,
      auto: true,
      why,
    });
  }
  // Answer from the tracker when it is on, otherwise put the question to the player.
  function answerFromTracker(state, node, answer, why) {
    if (state.settings.tracker) answerAuto(state, node, answer, why);
    else ask(state, node);
  }
  // Evaluate which of `ids` are playable (asking the player as needed), keep them as this walk's candidates and answer "any playable?".
  function answerByPlayableCount(state, node, ids, context, noun) {
    const playable = evalPlayable(state, ids, context);
    if (playable === PENDING) return PENDING;
    state.walk.cands = playable;
    answerAuto(
      state,
      node,
      playable.length > 0,
      playable.length + " " + noun + (playable.length === 1 ? "" : "s"),
    );
  }
  // The facts a decision handler may need, gathered once per decision.
  function decisionFacts(state) {
    const cardsOn = state.settings.cards,
      trackerOn = state.settings.tracker;
    return {
      trackerOn,
      cardsOn,
      diceOn: state.settings.dice,
      wome: state.settings.wome,
      factionsKnown: trackerOn || (cardsOn && state.settings.wome),
      board: state.board,
      walk: state.walk,
      handCount: engine.handCounts(state),
    };
  }
  const characterHand = (state) =>
    engine.handCardsOfDeck(state, DECK.CHARACTER);
  const strategyHand = (state) => engine.handCardsOfDeck(state, DECK.STRATEGY);

  // ---- Phases 1-4
  function decideHandOver6(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.total > 6,
        "hand: " + handCount.total,
      );
    ask(state, node);
  }
  function decideStrategyCardsOver1(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.strategy > 1,
        "Strategy cards: " + handCount.strategy,
      );
    ask(state, node);
  }
  function decideFactionHandOver4(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.faction > 4,
        "Faction cards: " + handCount.faction,
      );
    ask(state, node);
  }
  function decideCorruptionBelowVP(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.corruption < board.shadowVP,
      "Corruption " + board.corruption + " vs Shadow VP " + board.shadowVP,
    );
  }
  function decideVPBelowCorruption(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.shadowVP < board.corruption,
      "Shadow VP " + board.shadowVP + " vs Corruption " + board.corruption,
    );
  }
  function decideFellowshipAtStart(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.fs.atStart && board.fs.progress === 0,
      "tracker",
    );
  }
  function decideFellowshipInMordor(state, node, { board }) {
    answerFromTracker(state, node, board.fs.mordor, "tracker");
  }
  const decideProgressOver = (limit) =>
    function decideProgress(state, node, { board }) {
      answerFromTracker(
        state,
        node,
        board.fs.progress > limit,
        "Progress " + board.fs.progress,
      );
    };
  function decideWinOrSevenDice(state, node, { diceOn }) {
    if (diceOn && engine.diceCount(state) === engine.BASE_ACTION_DICE)
      return answerAuto(
        state,
        node,
        true,
        "Shadow has " + engine.BASE_ACTION_DICE + " dice",
      );
    ask(
      state,
      node,
      "*Mobile* army adjacent to *target* which would win the game" +
        (diceOn ? "" : " or Shadow only has 7 dice"),
    );
  }
  // ---- Phase 5
  // Character cards in hand while the Fellowship is on the Mordor track or revealed.
  function decideCharacterCardsWithFellowshipOut(
    state,
    node,
    { trackerOn, cardsOn, board, handCount },
  ) {
    if (!trackerOn && !cardsOn) return ask(state, node);
    const onMordorOrRevealed = boardFactYesNo(
      state,
      "mordor",
      "Is the Fellowship on the Mordor track or revealed?",
      board.fs.mordor || board.fs.revealed,
    );
    if (onMordorOrRevealed === PENDING) return PENDING;
    if (!onMordorOrRevealed)
      return answerAuto(
        state,
        node,
        false,
        "Fellowship not on the Mordor track or revealed",
      );
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.character > 0,
        "Character cards: " + handCount.character,
      );
    ask(
      state,
      node,
      "Character cards > 0? (the Fellowship is on the Mordor track or revealed)",
    );
  }
  function decideWitchKingInPlay(state, node, { trackerOn, board }) {
    if (trackerOn && !board.chars.witchKing)
      return answerAuto(state, node, false, "Witch King not in play");
    ask(state, node);
  }
  // Two-part decision: bold part, a minion can be mustered; plain part, Muster 2 can still advance a nation or recruit a faction.
  function decideMinionOrMuster2(state, node, { trackerOn, walk, wome }) {
    if (!trackerOn) return askDecision(state, node);
    if (walk.sub === 0) {
      const minions = engine.minionsAvailable(state);
      if (minions.length)
        return recordDecision(state, {
          text: NODE.text(node),
          ringCondition: true,
          answer: true,
          auto: true,
          why: minions[0].name + ": " + minions[0].why,
        });
      trail(state, {
        kind: TRAIL.QUESTION,
        text: NODE.text(node),
        answer: "No",
        auto: true,
        why: "no minion can be mustered (tracker)",
      });
      walk.sub = 1;
    }
    const seNotAtWar = !engine.shadowNationAtWar(state, "se"),
      noFactionInPlay = wome && !engine.shadowFactionInPlay(state);
    let why = "S&E at war" + (wome ? ", a faction is in play" : "");
    if (seNotAtWar) why = "Southrons & Easterlings not at war";
    else if (noFactionInPlay) why = "no faction recruited";
    recordDecision(state, {
      text: NODE.extra(node).t2,
      ringCondition: false,
      answer: seNotAtWar || noFactionInPlay,
      auto: true,
      why,
    });
  }
  function decideMordorWin(state, node, { trackerOn, board, walk }) {
    if (walk.sub === 0) {
      if (trackerOn && board.fs.mordor)
        return recordDecision(state, {
          text: NODE.text(node),
          ringCondition: true,
          answer: true,
          auto: true,
          why: "Fellowship on the Mordor track",
        });
      return ask(state, node, "*Target* would win the game", {
        sub: 1,
        bold: true,
      });
    }
    ask(state, node, NODE.extra(node).t2, { sub: 2 });
  }
  function decidePlayableCharacterCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        characterHand(state),
        "event",
        "playable Character card",
      );
    ask(state, node);
  }
  function decideAllFactionsInPlay(state, node, { factionsKnown }) {
    if (factionsKnown)
      return answerAuto(
        state,
        node,
        engine.allShadowFactionsInPlay(state),
        "tracker",
      );
    ask(state, node);
  }
  const decidePlayableRevealedCard = (noun) =>
    function decideRevealedCard(state, node, { cardsOn }) {
      if (cardsOn)
        return answerByPlayableCount(
          state,
          node,
          characterHand(state).filter((id) => cardById[id].revealed),
          "event",
          noun,
        );
      ask(state, node);
    };
  function decidePlayableMusterCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        strategyHand(state).filter((id) => cardById[id].type === "Muster"),
        "event",
        "playable Muster card",
      );
    ask(state, node);
  }
  const askAnyOf = (state, node) =>
    ask(state, node, null, { items: NODE.extra(node).items, any: true });
  function decideAnyConditionOrMordor(state, node, { trackerOn, board }) {
    if (trackerOn && board.fs.mordor)
      return answerAuto(state, node, true, "Fellowship is in Mordor");
    askAnyOf(state, node);
  }
  // ---- Character
  function decideNazgulInPlay(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.chars.witchKing || board.nazgul > 0,
      "tracker: " +
        board.nazgul +
        " Nazgûl" +
        (board.chars.witchKing ? ", Witch King in play" : ""),
    );
  }
  function decideNazgulOnMap(state, node, { trackerOn, board }) {
    if (trackerOn && board.nazgul === 0)
      return answerAuto(state, node, false, "no Nazgûl on the map");
    ask(state, node);
  }
  function decideMouthInPlay(state, node, { trackerOn, board }) {
    if (trackerOn && !board.chars.mouth)
      return answerAuto(state, node, false, "Mouth of Sauron not in play");
    ask(state, node);
  }
  function decideDieUsed(state, node, { walk }) {
    answerAuto(
      state,
      node,
      walk.dieUsed,
      walk.dieUsed ? "a move was made" : "nothing moved",
    );
  }
  // ---- Army
  function decideHuntDiceForArmy(state, node, { diceOn, trackerOn, board }) {
    if (diceOn && state.dice.hunt === 0)
      return answerAuto(state, node, false, "no dice in the Hunt box");
    if (trackerOn && board.fs.mordor)
      return answerAuto(state, node, false, "Fellowship in Mordor");
    ask(state, node);
  }
  // ---- Muster
  function decideMinionAvailable(state, node) {
    const minions = engine.minionsAvailable(state);
    answerFromTracker(
      state,
      node,
      minions.length > 0,
      minions.length
        ? minions[0].name + ": " + minions[0].why
        : "no minion can be mustered (tracker)",
    );
  }
  function decideWillOfTheWest(state, node, { trackerOn, board, walk }) {
    if (walk.fromReserve)
      return answerAuto(
        state,
        node,
        false,
        "the die set aside for the minion must be used now (Rulings)",
      );
    if (
      trackerOn &&
      (board.chars.gandalfWhite ||
        board.chars.saruman ||
        board.chars.witchKing ||
        board.chars.mouth)
    )
      return answerAuto(
        state,
        node,
        false,
        board.chars.gandalfWhite
          ? "Gandalf the White is in play"
          : "a minion is already in play",
      );
    ask(state, node);
  }
  function decideNationNotAtWar(state, node, { trackerOn, wome }) {
    if (!trackerOn) return ask(state, node);
    const nationNotAtWar = !engine.allShadowNationsAtWar(state);
    const noFactionInPlay = wome && !engine.shadowFactionInPlay(state);
    let why = "all at war" + (wome ? ", faction in play" : "");
    if (nationNotAtWar) why = "a Shadow nation is not at war";
    else if (noFactionInPlay) why = "no faction in play";
    answerAuto(state, node, nationNotAtWar || noFactionInPlay, why);
  }
  function decideFactionTopOfPriority(state, node, { walk }) {
    answerAuto(
      state,
      node,
      walk.nationChoice === "Faction",
      "priority chose " + (walk.nationChoice || "nothing"),
    );
  }
  function decideMusterChoiceCard(state, node, { cardsOn, walk }) {
    if (cardsOn && walk.chosen)
      return answerAuto(
        state,
        node,
        !!engine.MUSTER_CHOICE[walk.chosen],
        "card: " + cardById[walk.chosen].title,
      );
    ask(state, node);
  }
  function decideFewerThanSixNazgul(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.nazgul < 6,
      board.nazgul + " Nazgûl on the map",
    );
  }
  // ---- Event
  function decidePreferredPlayable(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        state.cards.hand
          .concat(state.cards.factionHand)
          .filter((id) => engine.cardFlags(cardById[id], state).preferred),
        "event",
        "playable *preferred* card",
      );
    ask(state, node);
  }
  function decideEventDie(state, node, { walk }) {
    if (walk.die)
      return answerAuto(
        state,
        node,
        walk.die === DIE_REQUIREMENT.EVENT,
        "using a " + DIE_REQUIREMENT_NAME[walk.die] + " die",
      );
    ask(state, node);
  }
  function decideHandUnder4(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.total < 4,
        "Event cards in hand: " + handCount.total,
      );
    ask(state, node);
  }
  function decideFactionHandUnder3(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.faction < 3,
        "Faction cards: " + handCount.faction,
      );
    ask(state, node);
  }
  function decideAnyPlayable(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        state.cards.hand.concat(state.cards.factionHand),
        "event",
        "playable card",
      );
    ask(state, node);
  }
  function decideHandAboveLimits(state, node, { cardsOn, wome, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.total > 6 || handCount.faction > 4,
        "hand " +
          handCount.total +
          "/6" +
          (wome ? ", faction " + handCount.faction + "/4" : ""),
      );
    ask(state, node);
  }
  function decidePlayableCorruptionCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        state.cards.hand.filter(
          (id) => cardById[id].corruption || cardById[id].tile,
        ),
        "event",
        "card",
      );
    ask(state, node);
  }
  // ---- Faction
  function decidePlayableFactionCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        state.cards.factionHand,
        "event",
        "playable Faction Event card",
      );
    ask(state, node);
  }
  function decideBlackSailsInPlay(state, node, { cardsOn, board }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        state.cards.factionTable.includes(CARD.BLACK_SAILS) &&
          board.factions.corsairs,
        "table",
      );
    ask(state, node);
  }
  function decideFactionPlayDie(state, node, { walk }) {
    if (walk.die)
      return answerAuto(
        state,
        node,
        walk.die === DIE_REQUIREMENT.FACTION_PLAY,
        "using " + DIE_REQUIREMENT_NAME[walk.die],
      );
    ask(state, node);
  }
  function decideFactionHandAboveLimit(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.faction > 4,
        "faction hand " + handCount.faction + "/4",
      );
    ask(state, node);
  }
  function decideFactionEligible(state, node, { cardsOn, trackerOn, walk }) {
    if (walk.factionChoice)
      return ask(
        state,
        node,
        "Are the " + walk.factionChoice + " eligible to be brought into play?",
      );
    if (cardsOn || trackerOn)
      return answerAuto(state, node, false, "every faction is already in play");
    ask(state, node);
  }
  // ---- Battle
  function decideUsableCharacterCombatCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        engine
          .combatCandidates(state)
          .filter((id) => cardById[id].deck === DECK.CHARACTER),
        "combat",
        "usable Character card",
      );
    ask(state, node);
  }
  function decideWitchKingFirstRound(state, node, { trackerOn, board, walk }) {
    if (walk.battleRound !== 1)
      return answerAuto(state, node, false, "not the first round");
    if (trackerOn && !board.chars.witchKing)
      return answerAuto(state, node, false, "Witch King not in play");
    ask(state, node, "Army includes the Witch King (this is the first round)");
  }
  function decideHandOver4(state, node, { cardsOn, handCount }) {
    if (cardsOn)
      return answerAuto(
        state,
        node,
        handCount.total > 4,
        "Event cards in hand: " + handCount.total,
      );
    ask(state, node);
  }
  function decideCallToBattleUsable(state, node, { cardsOn, wome, walk }) {
    if (!wome) return answerAuto(state, node, false, "WoME not in play");
    if (!cardsOn) return ask(state, node);
    const usable = evalPlayable(
      state,
      engine.callToBattleCards(state),
      "combat",
    );
    if (usable === PENDING) return PENDING;
    walk.ctb = usable;
    answerAuto(
      state,
      node,
      usable.length > 0,
      usable.length +
        " usable Call to Battle card" +
        (usable.length === 1 ? "" : "s"),
    );
  }
  function decideFirstRound(state, node, { walk }) {
    answerAuto(
      state,
      node,
      walk.battleRound === 1,
      "round " + walk.battleRound,
    );
  }
  function decideFieldBattleOrMilitary(state, node, { trackerOn, board }) {
    if (state.strategy === STRATEGY.MILITARY)
      return answerAuto(state, node, true, "military strategy");
    if (trackerOn && board.fs.mordor)
      return answerAuto(state, node, true, "Fellowship on the Mordor track");
    ask(
      state,
      node,
      "Field battle? (not military strategy; Fellowship not on the Mordor track)",
    );
  }
  function decideAggressiveContinue(state, node, { trackerOn, board }) {
    if (trackerOn && board.fs.mordor)
      return answerAuto(state, node, true, "Fellowship on the Mordor track");
    ask(state, node);
  }
  // The decision boxes the app can answer itself (or ask about with more context than the box text), keyed by page and node id.
  // A handler is (state, node, facts) and returns PENDING when it has opened a prompt.
  const DECISION_HANDLERS = {
    "C14.more6": decideHandOver6,
    "M14.more6": decideHandOver6,
    "C14.strat1": decideStrategyCardsOver1,
    "C14.more4f": decideFactionHandOver4,
    "M14.more4f": decideFactionHandOver4,
    "C14.corrLow": decideCorruptionBelowVP,
    "M14.vpLow": decideVPBelowCorruption,
    "C14.fsStart": decideFellowshipAtStart,
    "M14.fsStart": decideFellowshipAtStart,
    "C14.fsMordor": decideFellowshipInMordor,
    "M14.fsMordor": decideFellowshipInMordor,
    "C14.prog4": decideProgressOver(4),
    "M14.prog5": decideProgressOver(5),
    "C14.winOr7": decideWinOrSevenDice,
    "C5.charMordor": decideCharacterCardsWithFellowshipOut,
    "M5.charMordor": decideCharacterCardsWithFellowshipOut,
    "C5.wkNotMob": decideWitchKingInPlay,
    "M5.wkNotMob": decideWitchKingInPlay,
    "CH.wkJoin": decideWitchKingInPlay,
    "C5.minion": decideMinionOrMuster2,
    "M5.minion": decideMinionOrMuster2,
    "C5.mordorWin": decideMordorWin,
    "C5.playChar": decidePlayableCharacterCard,
    "C5.allFac": decideAllFactionsInPlay,
    "M5.revCard": decidePlayableRevealedCard(
      "playable “Fellowship revealed” card",
    ),
    "M5.playMuster": decidePlayableMusterCard,
    "MU.musterCard": decidePlayableMusterCard,
    "M5.anyCond": decideAnyConditionOrMordor,
    "CH.nazInPlay": decideNazgulInPlay,
    "CH.nazFs": decideNazgulOnMap,
    "CH.nazJoin": decideNazgulOnMap,
    "CH.mosMob": decideMouthInPlay,
    "CH.dieUsed": decideDieUsed,
    "AR.huntDice": decideHuntDiceForArmy,
    "MU.minion": decideMinionAvailable,
    "MU.wotw": decideWillOfTheWest,
    "MU.notWar": decideNationNotAtWar,
    "MU.facTop": decideFactionTopOfPriority,
    "MU.cardChoice": decideMusterChoiceCard,
    "MU.sixNaz": decideFewerThanSixNazgul,
    "EV.prefPlay": decidePreferredPlayable,
    "EV.eventDie": decideEventDie,
    "EV.less4": decideHandUnder4,
    "EV.less4b": decideHandUnder4,
    "EV.less3f": decideFactionHandUnder3,
    "EV.anyPlay": decideAnyPlayable,
    "EV.aboveFull": decideHandAboveLimits,
    "EV.revCard": decidePlayableRevealedCard("card"),
    "EV.corrCard": decidePlayableCorruptionCard,
    "FA.playable": decidePlayableFactionCard,
    "FA.blackSails": decideBlackSailsInPlay,
    "FA.playDie": decideFactionPlayDie,
    "FA.aboveFull": decideFactionHandAboveLimit,
    "FA.eligible": decideFactionEligible,
    "BA.playChar": decideUsableCharacterCombatCard,
    "BA.wkFirst": decideWitchKingFirstRound,
    "BA.more4": decideHandOver4,
    "BA.ctb": decideCallToBattleUsable,
    "BA.round1": decideFirstRound,
    "BA.fieldOrMil": decideFieldBattleOrMilitary,
    "BA.aggrCont": decideAggressiveContinue,
    "BA.anyCond": askAnyOf,
  };
  // A decision the app cannot answer: a two-part question asks the bold (ring) part first, then the plain part.
  function askDecision(state, node) {
    const nodeExtra = NODE.extra(node),
      walk = state.walk;
    if (nodeExtra.t2 && !nodeExtra.any) {
      if (walk.sub === 0)
        return ask(state, node, NODE.text(node), { sub: 1, bold: true });
      return ask(state, node, nodeExtra.t2, { sub: 2 });
    }
    ask(
      state,
      node,
      null,
      nodeExtra.any ? { items: nodeExtra.items, any: true } : null,
    );
  }
  function handleDecision(state, node) {
    if (NODE.extra(node).wome && !state.settings.wome)
      return answerAuto(state, node, false, "WoME not in play");
    const handler = DECISION_HANDLERS[state.walk.page + "." + state.walk.node];
    if (handler) return handler(state, node, decisionFacts(state));
    askDecision(state, node);
  }

  // ----- playability evaluation with lazy prompts -----
  // A card's precondition in this context: the combat test in a battle, the board test when the tracker is on, otherwise taken as met.
  function playablePre(state, card, id, ctx) {
    if (ctx === "combat") return engine.combatPrecondition(state, card);
    return state.settings.tracker ? engine.precondition(state, id) : true;
  }
  function evalPlayable(state, ids, ctx) {
    const out = [];
    for (const id of ids) {
      const card = cardById[id];
      const cacheKey = (ctx === "combat" ? "B:" : "") + id;
      if (state.playable[cacheKey] !== undefined) {
        if (state.playable[cacheKey]) out.push(id);
        continue;
      }
      const met = playablePre(state, card, id, ctx);
      if (met && typeof met === "object") {
        setPrompt(state, {
          type: PROMPT.SITUATIONAL,
          key: met.situ,
          text: met.q,
        });
        return PENDING;
      }
      if (!met) {
        state.playable[cacheKey] = false;
        continue;
      }
      setPrompt(state, { type: PROMPT.CONFIRM, card: id, ctx });
      return PENDING;
    }
    return out;
  }

  // ----- jumps -----
  function handleJump(state, node) {
    const walk = state.walk,
      spec = jumpSpec(NODE.text(node)),
      label = normalizeText(NODE.text(node));
    if (!spec) {
      trail(state, { kind: TRAIL.SKIP, text: label, why: "unknown box" });
      exitJump(state);
      return;
    }
    if (NODE.extra(node).wome && !state.settings.wome) {
      trail(state, { kind: TRAIL.SKIP, text: label, why: "WoME not in play" });
      exitJump(state);
      return;
    }
    const handler = JUMP_KIND[spec.kind];
    if (handler) handler(state, walk, spec, label);
    else jumpWithDie(state, spec, label);
  }
  // "Switch to military/Corruption": change strategy and either end the walk or restart it on the other strategy's page (rule 40).
  function switchStrategy(state, walk, spec, label) {
    state.strategy = spec.strategy;
    engine.log(state, "Strategy changed to " + spec.strategy + " (rule 40).");
    trail(state, { kind: TRAIL.JUMP, text: label });
    if (spec.endWalk) {
      endWalk(state, phaseResult(spec.endWalk), spec.text);
      return;
    }
    goto(state, spec.page, findStart(spec.page, spec.start));
    walk.trail[0] = {
      kind: TRAIL.START,
      text: spec.start,
      page: spec.page,
      node: walk.node,
    };
    follow(state, null);
  }
  // "Save muster die for minion": set the die aside and return to the calling page.
  function reserveDie(state, walk, spec, label) {
    // A die already set aside and brought back by "Use Muster die set aside for minion" must be used now (Rulings), not set aside again.
    if (walk.fromReserve) {
      trail(state, {
        kind: TRAIL.SKIP,
        text: label,
        why: "this die was already set aside — it must be used now",
      });
      exitJump(state);
      return;
    }
    state.minionReserved = true;
    if (walk.dieObj != null && state.settings.dice) {
      state.dice.pool[walk.dieObj].st = engine.DIE_STATE.RESERVED;
    }
    delete walk.dieAns[DIE_REQUIREMENT.MUSTER];
    delete walk.dieAns[DIE_REQUIREMENT.CHAR_OR_MUSTER]; // the die the player said Queller had is no longer available
    engine.log(state, "Muster die set aside for a minion (Rulings).");
    trail(state, {
      kind: TRAIL.NOTE,
      text: "Muster die set aside for a minion",
    });
    walk.dieObj = null;
    walk.die = null;
    doReturn(state);
  }
  // "Phase 5 (use a ring)": restart the walk looking for a ring use (rule 37) when a ring and a die to change are available.
  function ringAnyJump(state, walk, spec, label) {
    const canUseRing =
      walk.mode !== "ringAny" &&
      engine.ringAvailable(state) &&
      (!state.settings.dice ||
        engine.availableDice(state).some((die) => die.k === DIE_KIND.ACTION));
    if (canUseRing) {
      trail(state, { kind: TRAIL.JUMP, text: label });
      const entry = walk.entry;
      walk.done = true;
      state.walk = null;
      startWalk(state, entry.page, entry.start, { mode: "ringAny" });
      return;
    }
    let why = "no die to change";
    if (state.ringUsedThisTurn) why = "a ring was already used this turn";
    else if (engine.ringsKnown(state) && !state.board.rings)
      why = "no Elven Ring";
    trail(state, { kind: TRAIL.SKIP, text: label, why });
    exitJump(state);
  }
  // Grey boxes that do not name a page, by the `kind` of their JUMPS entry; a page name goes through jumpWithDie instead.
  const JUMP_KIND = {
    return: (state, walk, spec, label) => {
      trail(state, { kind: TRAIL.RETURN, text: label });
      doReturn(state);
    },
    endPhase4: (state) =>
      endWalk(state, phaseResult("Phase 5"), "Phase 5 begins — you act first."),
    battleNext: (state) =>
      endWalk(
        state,
        WALK_RESULT.BATTLE_NEXT,
        "Another combat round: walk again from “Battle (next round)”.",
      ),
    switch: switchStrategy,
    reserve: reserveDie,
    ringAny: ringAnyJump,
  };
  // Grey box naming a page: enter it with the die it needs (or the die already held), or skip it.
  function jumpWithDie(state, spec, label) {
    const walk = state.walk;
    if (engine.dieSatisfies(walk.die, spec.die)) {
      enterPage(state, spec, label);
      return;
    }
    const dieResult = ensureDie(state, spec.die, label);
    if (dieResult === PENDING) return;
    if (dieResult) enterPage(state, spec, label);
    else exitJump(state);
  }
  // Make sure Queller has a die of type `req` for the step `label`. Returns true (use it), false (skipped, trail written), or PENDING (prompt open).
  function ensureDie(state, req, label) {
    const walk = state.walk;
    if (walk.pendingDie === label) {
      walk.pendingDie = null;
      const dieResult = walk.dieAns[req];
      walk.ringArmed = false;
      if (!dieResult)
        trail(state, {
          kind: TRAIL.SKIP,
          text: label,
          why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
        });
      return !!dieResult;
    }
    if (state.settings.dice) return ensureDieFromPool(state, walk, req, label);
    return askForDie(state, walk, req, label);
  }
  // With dice rolled by the app: take a matching die from the pool, changing one with an Elven Ring when that is armed.
  function ensureDieFromPool(state, walk, req, label) {
    let die = engine.findDie(state, req);
    if (!die && ringPossible(state)) {
      die = engine.ringChange(state, req);
      if (die)
        trail(state, {
          kind: TRAIL.RING,
          text: "Elven Ring: die changed to " + die.face,
        });
    }
    walk.ringArmed = false;
    if (!die) {
      trail(state, {
        kind: TRAIL.SKIP,
        text: label,
        why: "no " + DIE_REQUIREMENT_NAME[req] + " die available",
      });
      return false;
    }
    walk.dieObj = state.dice.pool.indexOf(die);
    return true;
  }
  // Without dice: ask the player whether Queller has the die (once per type per walk), then offer an Elven Ring before giving up.
  function askForDie(state, walk, req, label) {
    if (walk.dieAns[req] === undefined) {
      setPrompt(state, {
        type: PROMPT.DIE_CHECK,
        req,
        label,
        text:
          "Does Queller have " +
          dieWithArticle(req) +
          " die available" +
          (req === DIE_REQUIREMENT.ARMY || req === DIE_REQUIREMENT.MUSTER
            ? " (an Army/Muster die counts)"
            : "") +
          "?",
      });
      return PENDING;
    }
    if (walk.dieAns[req]) {
      walk.ringArmed = false;
      return true;
    }
    if (ringPossible(state) && !walk.ringAsked) {
      walk.ringAsked = true;
      setPrompt(state, {
        type: PROMPT.RING,
        req,
        label,
        text:
          (engine.ringsKnown(state)
            ? ""
            : "If the Shadow holds an Elven Ring: ") +
          "Use an Elven Ring (rule 36): change one Queller die that does not show a *preferred* result into " +
          dieWithArticle(req) +
          " result. Choose the die at random.",
      });
      return PENDING;
    }
    walk.ringArmed = false;
    trail(state, {
      kind: TRAIL.SKIP,
      text: label,
      why: "no " + DIE_REQUIREMENT_NAME[req] + " die",
    });
    return false;
  }
  function ringPossible(state) {
    const walk = state.walk;
    return (
      engine.ringAvailable(state) && (walk.ringArmed || walk.mode === "ringAny")
    );
  }
  function enterPage(state, spec, label) {
    const walk = state.walk;
    walk.stack.push({
      page: walk.page,
      node: walk.node,
      die: walk.die,
      dieObj: walk.dieObj,
      dieUsed: walk.dieUsed,
    });
    if (!engine.dieSatisfies(walk.die, spec.die)) walk.die = spec.die;
    trail(state, {
      kind: TRAIL.JUMP,
      text: label,
      die: DIE_REQUIREMENT_NAME[walk.die],
    });
    walk.ringAsked = false;
    walk.cands = null;
    walk.chosen = null;
    walk.steps = null;
    goto(state, spec.page, findStart(spec.page, spec.start));
    follow(state, null);
  }
  function exitJump(state) {
    // follow the arrow out of the current grey box; if none, return further
    if (!follow(state, null)) doReturn(state);
  }
  function doReturn(state) {
    const walk = state.walk;
    if (!walk.stack.length) {
      // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (Rulings: it cannot be used for anything else).
      if (
        walk.fromReserve &&
        state.settings.dice &&
        walk.reserveDieObj != null &&
        state.dice.pool[walk.reserveDieObj].st === engine.DIE_STATE.AVAIL
      ) {
        engine.spendDie(
          state,
          state.dice.pool[walk.reserveDieObj],
          "set aside for a minion, no action possible",
        );
        endWalk(
          state,
          WALK_RESULT.ACTION,
          "Queller sets aside the Muster die it had kept for a minion — no action was possible with it.",
        );
        return;
      }
      endWalk(
        state,
        WALK_RESULT.NO_ACTION,
        walk.page === "BA"
          ? "Nothing further from the Battle page this round."
          : "Queller has no action from this walk.",
      );
      return;
    }
    const frame = walk.stack.pop();
    goto(state, frame.page, frame.node);
    walk.die = frame.die;
    walk.dieObj = frame.dieObj;
    walk.dieUsed = frame.dieUsed;
    walk.cands = null;
    walk.chosen = null;
    trail(state, {
      kind: TRAIL.BACK,
      text: normalizeText(NODE.text(cur(state))),
    });
    exitJump(state);
  }

  // ----- actions -----
  // Draw steps and actions on the Event/Faction pages: the deck depends on the box; with cards off the player draws.
  // The deck a draw node draws from: Character or Faction Event where the node says so, otherwise the strategy's preferred deck.
  function drawDeck(state, key) {
    if (key === "EV.drawChar") return DECK.CHARACTER;
    if (key === "EV.drawFac" || key === "FA.drawT") return DECK.FACTION;
    return state.strategy === STRATEGY.CORRUPTION
      ? DECK.CHARACTER
      : DECK.STRATEGY;
  }
  function drawStep(state, node, key) {
    const walk = state.walk,
      label = normalizeText(NODE.text(node)),
      isStep = NODE.kind(node) === NODE_KIND.STEP;
    if (!state.settings.cards)
      return setPrompt(state, {
        type: isStep ? PROMPT.STEP : PROMPT.ACTION,
        text: label,
        node: walk.node,
      });
    const deckKey = drawDeck(state, key);
    const id = engine.drawCard(state, deckKey);
    trail(state, {
      kind: TRAIL.NOTE,
      text:
        "Drew a " +
        engine.deckName(deckKey) +
        " card" +
        (id ? "" : " — deck empty"),
    });
    if (isStep) {
      follow(state, null);
      return;
    }
    const handCount = engine.handCounts(state);
    setPrompt(state, {
      type: PROMPT.ACTION,
      text:
        label +
        " — done: Queller now holds " +
        handCount.total +
        " Event card" +
        (state.settings.wome
          ? "s and " + handCount.faction + " Faction Event card"
          : "") +
        "s.",
      node: walk.node,
      auto: true,
    });
  }
  function handleAction(state, node) {
    const walk = state.walk,
      key = walk.page + "." + walk.node,
      label = normalizeText(NODE.text(node)),
      nodeExtra = NODE.extra(node),
      cards = state.settings.cards,
      dice = state.settings.dice;
    if (nodeExtra.die && !(walk.die === nodeExtra.die && walk.dieObj != null)) {
      const dieResult = ensureDie(state, nodeExtra.die, label);
      if (dieResult === PENDING) return;
      if (!dieResult) {
        exitAction(state);
        return;
      }
      walk.die = nodeExtra.die;
    }
    switch (key) {
      case "C14.sogCorr":
      case "M14.sogCorr":
        state.strategy = STRATEGY.CORRUPTION;
        engine.log(state, "Queller uses the corruption strategy.");
        endWalk(
          state,
          WALK_RESULT.STRATEGY,
          "Queller uses the corruption strategy.",
        );
        return;
      case "C14.sogMil":
      case "M14.sogMil":
        state.strategy = STRATEGY.MILITARY;
        engine.log(state, "Queller uses the military strategy.");
        endWalk(
          state,
          WALK_RESULT.STRATEGY,
          "Queller uses the military strategy.",
        );
        return;
      case "C5.discardDie":
      case "M5.discardDie":
        if (dice) {
          const available = engine.availableDice(state);
          if (!available.length) {
            trail(state, {
              kind: TRAIL.SKIP,
              text: label,
              why: "no die left to discard",
            });
            exitAction(state);
            return;
          }
          const die = engine.pick(available);
          die.st = engine.DIE_STATE.USED;
          engine.log(
            state,
            "Discarded an unplayable " + die.face + " die at random (rule 32).",
          );
          endWalk(
            state,
            WALK_RESULT.ACTION,
            "Queller sets aside a " +
              die.face +
              " die it could not use (rule 32).",
          );
          return;
        }
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text: "Discard unplayable die: set aside one Queller die that could not be used, chosen at random (rule 32).",
          node: walk.node,
        });
      case "C5.minionDie":
      case "M5.minionDie": {
        const reserved = dice
          ? state.dice.pool.find((die) => die.st === engine.DIE_STATE.RESERVED)
          : null;
        if (dice ? !reserved : !state.minionReserved) {
          trail(state, {
            kind: TRAIL.SKIP,
            text: label,
            why: "no Muster die set aside",
          });
          endWalk(
            state,
            WALK_RESULT.NO_ACTION,
            "Queller has no action — it has no die it can use.",
          );
          return;
        }
        let reservedIndex = null;
        if (dice) {
          reserved.st = engine.DIE_STATE.AVAIL;
          reservedIndex = state.dice.pool.indexOf(reserved);
          state.minionReserved = state.dice.pool.some(
            (die) => die.st === engine.DIE_STATE.RESERVED,
          );
        } else state.minionReserved = false;
        walk.fromReserve = true;
        walk.reserveDieObj = reservedIndex;
        trail(state, {
          kind: TRAIL.JUMP,
          text: "Muster 2 (die set aside for the minion)",
        });
        walk.stack.push({
          page: walk.page,
          node: walk.node,
          die: null,
          dieObj: null,
          dieUsed: false,
        });
        walk.die = DIE_REQUIREMENT.MUSTER;
        walk.dieObj = reservedIndex;
        goto(state, "MU", findStart("MU", "Muster 2"));
        follow(state, null);
        return;
      }
      case "C5.pass":
      case "M5.pass":
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text: "Pass",
          node: walk.node,
          pass: true,
          help: "Only if the game rules permit a pass (Rulings). If Queller cannot pass, follow the arrow out.",
        });
      case "EV.drawPref":
      case "EV.drawChar":
      case "EV.drawFac":
        return drawStep(state, node, key);
      case "EV.discard":
      case "FA.discard": {
        if (cards && walk.discards) {
          if (walk.die) spendCurrentDie(state, "drew a card");
          endWalk(
            state,
            WALK_RESULT.ACTION,
            "Discarded down to the hand limit.",
          );
          return;
        }
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text: "Discard the card chosen by the priority list.",
          node: walk.node,
        });
      }
      case "EV.playA":
      case "EV.playB":
      case "EV.playC":
      case "EV.playD":
      case "FA.playA":
      case "MU.musterCardA":
      case "M5.playCharDie":
      case "M5.playEventDie": {
        if (cards && !walk.chosen && walk.cands?.length) {
          const picked = engine.applyPriority(state, walk.cands, [
            "Ascending order of initiative",
          ]);
          walk.chosen = picked.chosen;
          walk.steps = picked.steps;
        }
        if (cards && walk.chosen) {
          return setPrompt(state, {
            type: PROMPT.PLAY_CARD,
            card: walk.chosen,
            text: label,
            node: walk.node,
          });
        }
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text: label,
          node: walk.node,
        });
      }
      case "MU.musterE":
      case "MU.musterEnd": {
        if (cards && walk.chosen) {
          return setPrompt(state, {
            type: PROMPT.PLAY_CARD,
            card: walk.chosen,
            text: "Muster with the card",
            node: walk.node,
          });
        }
        break;
      }
      case "MU.polTrack": {
        if (!walk.nationChoice || walk.nationChoice === "Faction") {
          trail(state, {
            kind: TRAIL.SKIP,
            text: label,
            why: "no nation to advance",
          });
          exitAction(state);
          return;
        }
        const nationKey = SHADOW_NATION_KEY[walk.nationChoice];
        if (!state.settings.tracker)
          return setPrompt(state, {
            type: PROMPT.ACTION,
            text:
              "Move " + walk.nationChoice + " down one on the Political Track.",
            node: walk.node,
          });
        const now = state.board.nations[nationKey] ?? 0,
          next = Math.max(0, now - 1);
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text:
            "Move " +
            walk.nationChoice +
            " down one on the Political Track (" +
            engine.politicalTrackLabel(now) +
            " → " +
            engine.politicalTrackLabel(next) +
            ").",
          node: walk.node,
          nation: nationKey,
        });
      }
      case "MU.musterMinion":
        if (!walk.minionPick) {
          trail(state, {
            kind: TRAIL.SKIP,
            text: label,
            why: "no minion can be mustered",
          });
          exitAction(state);
          return;
        }
        return setPrompt(state, {
          type: PROMPT.ACTION,
          text: "Muster " + walk.minionPick + ".",
          node: walk.node,
          minion: {
            Saruman: "saruman",
            "Witch King": "witchKing",
            "Mouth of Sauron": "mouth",
          }[walk.minionPick],
        });
      case "FA.bringIn":
        if (walk.factionChoice)
          return setPrompt(state, {
            type: PROMPT.ACTION,
            text: "Bring the " + walk.factionChoice + " into play.",
            node: walk.node,
            faction: walk.factionChoice.toLowerCase(),
          });
        if (cards || state.settings.tracker) {
          trail(state, {
            kind: TRAIL.SKIP,
            text: label,
            why: "no faction to bring in",
          });
          exitAction(state);
          return;
        }
        break;
    }
    if (/^End( action)?$/.test(label)) {
      endWalk(
        state,
        walk.die ? WALK_RESULT.ACTION : WALK_RESULT.END,
        "End of " + (walk.die ? "action" : "walk") + ".",
      );
      if (walk.die) spendCurrentDie(state, "end of action");
      return;
    }
    setPrompt(state, {
      type: PROMPT.ACTION,
      text: label,
      node: walk.node,
      help: nodeExtra.help,
    });
  }
  function spendCurrentDie(state, why) {
    const walk = state.walk;
    if (!walk?.die) return;
    if (state.settings.dice && walk.dieObj != null) {
      engine.spendDie(state, state.dice.pool[walk.dieObj], why);
    } else
      engine.log(
        state,
        "Queller used a " +
          DIE_REQUIREMENT_NAME[walk.die] +
          " die" +
          (why ? " — " + why : "") +
          ".",
      );
    walk.die = null;
    walk.dieObj = null;
  }
  function exitAction(state) {
    // rule 29
    if (follow(state, null)) return;
    doReturn(state);
  }

  // ----- steps (orange) -----
  // A step the app performed itself: record it and move on.
  function continueStep(state, label, why) {
    trail(state, { kind: TRAIL.STEP, text: label, auto: true, why });
    follow(state, null);
  }
  function handleStep(state, node) {
    const walk = state.walk,
      key = walk.page + "." + walk.node,
      label = normalizeText(NODE.text(node)),
      nodeExtra = NODE.extra(node),
      dice = state.settings.dice,
      cards = state.settings.cards;
    const continueWith = (why) => continueStep(state, label, why);
    switch (key) {
      case "C14.rec":
      case "M14.rec":
        if (dice) {
          engine.recoverDice(state);
          return continueWith("pool: " + state.dice.pool.length + " dice");
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text:
            "Recover Queller’s action dice" +
            (state.settings.wome
              ? " (and the Faction die if a Shadow faction is in play)"
              : "") +
            ".",
          node: walk.node,
        });
      case "C14.draw":
      case "M14.draw":
        if (cards) {
          engine.drawCard(state, DECK.CHARACTER);
          engine.drawCard(state, DECK.STRATEGY);
          if (state.settings.wome) engine.drawCard(state, DECK.FACTION);
          return continueWith(
            "hand: " +
              engine.handCounts(state).total +
              (state.settings.wome
                ? " + " + engine.handCounts(state).faction + " faction"
                : ""),
          );
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text:
            "Draw one Character and one Strategy Event card for Queller" +
            (state.settings.wome ? ", and one Faction Event card" : "") +
            ".",
          node: walk.node,
        });
      case "C14.disc14":
      case "C14.disc18":
      case "M14.disc":
        if (cards) {
          const discarded = engine.autoDiscard(
            state,
            nodeExtra.items,
            HAND.EVENT,
          );
          return continueWith(
            "discarded " +
              discarded.map((i) => "“" + cardById[i].title + "”").join(", "),
          );
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text: label,
          items: nodeExtra.items,
          node: walk.node,
        });
      case "C14.discF":
      case "M14.discF":
        if (cards) {
          const discarded = engine.autoDiscard(
            state,
            nodeExtra.items,
            HAND.FACTION,
          );
          return continueWith(
            "discarded " +
              discarded.map((i) => "“" + cardById[i].title + "”").join(", "),
          );
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text: label,
          items: nodeExtra.items,
          node: walk.node,
        });
      case "C14.rollHunt":
        if (dice) {
          const roll = engine.randomBelow(6) + 1;
          const placed = isLowRoll(roll) ? 0 : 1;
          engine.log(
            state,
            "Rolled " +
              roll +
              " for the hunt allocation → " +
              placed +
              " dice.",
          );
          engine.assignHunt(state, placed);
          return continueWith(
            "rolled " + roll + " → " + placed + " in the Hunt box",
          );
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text: label,
          node: walk.node,
        });
      case "C14.huntMax":
      case "M14.huntMax":
        if (dice) {
          const placed = engine.assignHunt(state, engine.huntCap(state));
          return continueWith(
            placed +
              " dice (Companions: " +
              (state.board.fs.companions ?? 0) +
              ")",
          );
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text: label + " (up to the number of Companions, minimum 1).",
          node: walk.node,
        });
      case "C14.hunt1a":
      case "C14.hunt1b":
      case "M14.hunt1":
        if (dice) {
          engine.assignHunt(state, 1);
          return continueWith();
        }
        break;
      case "C14.hunt2a":
      case "C14.hunt2b":
      case "M14.hunt2":
        if (dice) {
          const placed = engine.assignHunt(state, 2);
          return continueWith(
            placed < 2
              ? "capped at " +
                  placed +
                  " (rule 34: " +
                  (state.board.fs.companions ?? 0) +
                  " Companions)"
              : undefined,
          );
        }
        break;
      case "M14.hunt0":
        if (dice) {
          engine.log(state, "No dice placed in the Hunt box before rolling.");
          return continueWith();
        }
        break;
      case "C14.rollRest":
      case "M14.rollRest":
        if (dice) {
          const faces = engine.rollRemaining(state);
          return continueWith(faces.join(", "));
        }
        return setPrompt(state, {
          type: PROMPT.STEP,
          text: "Roll Queller’s remaining action dice. Put every Eye in the Hunt box.",
          node: walk.node,
        });
      case "C14.sogRoll":
      case "M14.sogRoll":
        if (dice) {
          const roll = engine.randomBelow(6) + 1;
          engine.log(state, "Strategy roll: " + roll + ".");
          trail(state, {
            kind: TRAIL.STEP,
            text: "Roll a die",
            auto: true,
            why: "rolled " + roll,
          });
          follow(
            state,
            isLowRoll(roll) ? STRATEGY_ROLL.LOW : STRATEGY_ROLL.HIGH,
          );
          return;
        }
        return setPrompt(state, {
          type: PROMPT.ROLL,
          text: "Roll a die: 1-3 corruption strategy, 4-6 military strategy.",
          node: walk.node,
          options: [STRATEGY_ROLL.LOW, STRATEGY_ROLL.HIGH],
        });
      case "BA.playCard":
        if (cards) {
          if (walk.chosen) {
            return setPrompt(state, {
              type: PROMPT.PLAY_CARD,
              card: walk.chosen,
              text: "Play combat card",
              node: walk.node,
              combat: true,
            });
          }
          return continueWith("no card to play");
        }
        break;
      case "FA.drawT":
      case "EV.drawPrefT":
        return drawStep(state, node, key);
    }
    setPrompt(state, {
      type: PROMPT.STEP,
      text: label,
      items: nodeExtra.items,
      node: walk.node,
      move: label.startsWith("Move"),
    });
  }

  // ----- priority lists -----
  // A priority list resolved without a card pick: record it and move on.
  function continuePriority(state, node, why) {
    trail(state, {
      kind: TRAIL.PRIORITY,
      text: NODE.text(node),
      items: NODE.extra(node).items,
      auto: true,
      why,
    });
    follow(state, null);
  }
  function handlePriority(state, node) {
    const walk = state.walk,
      key = walk.page + "." + walk.node,
      nodeExtra = NODE.extra(node),
      cards = state.settings.cards,
      label = NODE.text(node);
    const continueWith = (why) => continuePriority(state, node, why);
    if (cards) {
      const cardPriorityNodes = [
        "EV.prefPri",
        "EV.anyPri",
        "FA.playPri",
        "BA.sortiePri",
        "BA.wkPri",
        "BA.atkPri",
        "BA.defPri",
      ];
      if (cardPriorityNodes.includes(key)) {
        if (key === "BA.wkPri" || key === "BA.atkPri" || key === "BA.defPri") {
          // every card Queller could use as a combat card, plus Call to Battle cards
          const playable = evalPlayable(
            state,
            engine.combatCandidates(state),
            "combat",
          );
          if (playable === PENDING) return;
          walk.cands = playable;
          if (state.settings.wome) {
            const callToBattle = evalPlayable(
              state,
              engine.callToBattleCards(state),
              "combat",
            );
            if (callToBattle === PENDING) return;
            walk.ctb = callToBattle;
          } else walk.ctb = [];
        }
        let candidates = (walk.cands || []).slice();
        if (key === "BA.atkPri") candidates = candidates.concat(walk.ctb || []);
        if (!candidates.length) {
          walk.chosen = null;
          return continueWith("no candidate card");
        }
        const picked = engine.applyPriority(state, candidates, nodeExtra.items);
        walk.chosen = picked.chosen;
        walk.steps = picked.steps;
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: label,
          items: nodeExtra.items,
          steps: picked.steps,
          card: picked.chosen,
          auto: true,
        });
        follow(state, null);
        return;
      }
      if (key === "EV.discPri" || key === "FA.discPri") {
        const discarded = [];
        if (key === "EV.discPri") {
          discarded.push(
            ...engine.autoDiscard(state, nodeExtra.items, HAND.EVENT),
          );
          if (state.settings.wome)
            discarded.push(
              ...engine.autoDiscard(
                state,
                NODE.extra(FLOW.FA.nodes.discPri).items,
                HAND.FACTION,
              ),
            );
        } else
          discarded.push(
            ...engine.autoDiscard(state, nodeExtra.items, HAND.FACTION),
          );
        walk.discards = discarded;
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: label,
          items: nodeExtra.items,
          steps: discarded.length
            ? discarded.map((i) => "Discarded “" + cardById[i].title + "”")
            : ["Nothing to discard"],
          auto: true,
        });
        follow(state, null);
        return;
      }
      if (key === "FA.recruitPri") {
        const inPlay = state.board.factions;
        const counts = {};
        for (const id of state.cards.factionHand.concat(
          state.cards.factionTable,
        )) {
          const card = cardById[id];
          if (!card.faction) continue;
          const factionName = card.faction;
          counts[factionName] = counts[factionName] || {
            preferred: 0,
            total: 0,
          };
          counts[factionName].total++;
          if (engine.cardFlags(card, state).preferred)
            counts[factionName].preferred++;
        }
        const notInPlay = ["Corsairs", "Dunlendings", "Spiders"].filter(
          (name) => !inPlay[name.toLowerCase()],
        );
        const preferredOf = (name) =>
            (counts[name] || { preferred: 0 }).preferred,
          totalOf = (name) => (counts[name] || { total: 0 }).total;
        let best = notInPlay.slice(),
          steps = [];
        if (best.length > 1) {
          const most = Math.max(...best.map(preferredOf));
          best = best.filter((name) => preferredOf(name) === most);
          steps.push(
            "most *preferred* Faction Event cards → " + best.join(", "),
          );
        }
        if (best.length > 1) {
          const most = Math.max(...best.map(totalOf));
          best = best.filter((name) => totalOf(name) === most);
          steps.push("most Faction Event cards → " + best.join(", "));
        }
        if (best.length > 1) {
          best = [engine.pick(best)];
          steps.push("tie — chosen at random (rule 3)");
        }
        walk.factionChoice = best[0] || null;
        if (!best.length) steps.push("all factions already in play");
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: label,
          items: nodeExtra.items,
          steps,
          choice: walk.factionChoice || "none",
          auto: true,
        });
        follow(state, null);
        return;
      }
    }
    if (key === "FA.recruitPri" && state.settings.tracker) {
      // without cards the tracker still knows which factions are left; the player picks among them
      const notInPlay = ["Corsairs", "Dunlendings", "Spiders"].filter(
        (name) => !state.board.factions[name.toLowerCase()],
      );
      if (notInPlay.length <= 1) {
        walk.factionChoice = notInPlay[0] || null;
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: label,
          items: nodeExtra.items,
          steps: [
            notInPlay.length
              ? "Only the " + notInPlay[0] + " are not yet in play"
              : "all factions already in play",
          ],
          choice: walk.factionChoice || "none",
          auto: true,
        });
        follow(state, null);
        return;
      }
      return setPrompt(state, {
        type: PROMPT.CHOICE,
        text: "Recruit priority: which faction has the most Faction Event cards in Queller’s hand and in play (preferred cards first)?",
        items: nodeExtra.items,
        options: notInPlay.map((name) => ({ value: name, label: name })),
        set: "factionChoice",
        node: walk.node,
        page: walk.page,
        pri: label,
      });
    }
    if (key === "MU.nationPri") {
      const nations = state.board.nations,
        allFactionsInPlay = engine.allShadowFactionsInPlay(state);
      if (!state.settings.tracker) {
        const factionsKnown = state.settings.cards && state.settings.wome;
        const options = [
          { value: "Isengard", label: "Isengard (not yet At War)" },
        ];
        if (state.settings.wome && !(factionsKnown && allFactionsInPlay))
          options.push({
            value: "Faction",
            label: "Faction (a Shadow faction can still be recruited)",
          });
        options.push(
          { value: "Sauron", label: "Sauron (not yet At War)" },
          {
            value: "Southrons and Easterlings",
            label: "Southrons and Easterlings (not yet At War)",
          },
          { value: "", label: "None of these" },
        );
        return setPrompt(state, {
          type: PROMPT.CHOICE,
          text: "Political Track priority: which is the first of these that applies?",
          items: nodeExtra.items,
          options,
          set: "nationChoice",
          node: walk.node,
          page: walk.page,
          pri: label,
        });
      }
      const eligible = [];
      if (!engine.shadowNationAtWar(state, "isengard"))
        eligible.push("Isengard");
      if (state.settings.wome && !allFactionsInPlay) eligible.push("Faction");
      if (!engine.shadowNationAtWar(state, "sauron")) eligible.push("Sauron");
      if (!engine.shadowNationAtWar(state, "se"))
        eligible.push("Southrons and Easterlings");
      walk.nationChoice = eligible[0] || null;
      const trackPositions = ["sauron", "isengard", "se"]
        .map(
          (nationKey) =>
            SHADOW_NATION_NAME[nationKey] +
            ": " +
            engine.politicalTrackLabel(nations[nationKey] ?? 0),
        )
        .join(", ");
      trail(state, {
        kind: TRAIL.PRIORITY,
        text: label,
        items: nodeExtra.items,
        steps: [
          "Political Track — " + trackPositions,
          eligible.length
            ? "Eligible: " + eligible.join(", ")
            : "Every Shadow nation is at war",
        ],
        choice: walk.nationChoice || "none",
        auto: true,
      });
      follow(state, null);
      return;
    }
    if (key === "MU.minionPri") {
      const chars = state.board.chars;
      if (!state.settings.tracker) {
        const minionsKnown = state.settings.dice;
        const options = [];
        if (!(minionsKnown && chars.saruman))
          options.push({
            value: "Saruman",
            label: "Saruman (Isengard At War)",
          });
        if (!(minionsKnown && chars.witchKing))
          options.push({
            value: "Witch King",
            label:
              "Witch King (Sauron At War and a Free Peoples nation At War)",
          });
        if (!(minionsKnown && chars.mouth))
          options.push({
            value: "Mouth of Sauron",
            label: "Mouth of Sauron (all Shadow nations At War)",
          });
        options.push({ value: "", label: "None can be mustered" });
        return setPrompt(state, {
          type: PROMPT.CHOICE,
          text: "Minion priority: which is the first of these that can be mustered (not already in play)?",
          items: nodeExtra.items,
          options,
          set: "minionPick",
          node: walk.node,
          page: walk.page,
          pri: label,
        });
      }
      const minions = engine.minionsAvailable(state);
      walk.minionPick = minions.length ? minions[0].name : null;
      trail(state, {
        kind: TRAIL.PRIORITY,
        text: label,
        items: nodeExtra.items,
        steps: minions.length
          ? ["Eligible: " + minions.map((minion) => minion.name).join(", ")]
          : ["No minion can be mustered"],
        choice: walk.minionPick || "none",
        auto: true,
      });
      follow(state, null);
      return;
    }
    setPrompt(state, {
      type: PROMPT.PRIORITY,
      text: label,
      items: nodeExtra.items,
      node: walk.node,
    });
  }

  // ----- answers from the UI -----
  function answer(state, value) {
    const walk = state.walk;
    if (!walk?.prompt) return;
    const prompt = walk.prompt;
    walk.prompt = null;
    const node = cur(state);
    switch (prompt.type) {
      case PROMPT.YES_NO: {
        if (prompt.part) {
          walk.parts[prompt.part] = !!value;
          trail(state, {
            kind: TRAIL.QUESTION,
            text: prompt.text,
            answer: value ? "Yes" : "No",
          });
          break;
        }
        if (prompt.sub === 1) {
          // bold part of a two-part decision
          if (value) {
            recordDecision(state, {
              text: prompt.text,
              ringCondition: true,
              answer: true,
              auto: false,
            });
          } else {
            trail(state, {
              kind: TRAIL.QUESTION,
              text: prompt.text,
              answer: "No",
            });
            walk.sub = 2;
          }
          break;
        }
        if (prompt.sub === 2) {
          recordDecision(state, {
            text: prompt.text,
            ringCondition: false,
            answer: value,
            auto: false,
          });
          break;
        }
        recordDecision(state, {
          text: NODE.text(node),
          ringCondition: NODE.extra(node).bold,
          answer: value,
          auto: false,
        });
        break;
      }
      case PROMPT.COUNT: {
        const count = Math.max(
          prompt.min,
          Math.min(prompt.max, Number.parseInt(value, 10) || 0),
        );
        walk.parts[prompt.part] = count;
        trail(state, {
          kind: TRAIL.QUESTION,
          text: prompt.text,
          answer: String(count),
        });
        break;
      }
      case PROMPT.CHOICE: {
        walk[prompt.set] = value || null;
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: prompt.pri,
          items: prompt.items,
          steps: ["You chose: " + (value || "none")],
          choice: value || "none",
        });
        follow(state, null);
        break;
      }
      case PROMPT.SITUATIONAL:
        state.situ[prompt.key] = !!value;
        trail(state, {
          kind: TRAIL.QUESTION,
          text: prompt.text,
          answer: value ? "Yes" : "No",
          situ: true,
        });
        break;
      case PROMPT.CONFIRM:
        state.playable[(prompt.ctx === "combat" ? "B:" : "") + prompt.card] =
          !!value;
        trail(state, {
          kind: TRAIL.REVEAL,
          text: cardById[prompt.card].title,
          answer: value ? "playable" : "not playable",
          card: prompt.card,
        });
        break;
      case PROMPT.DIE_CHECK:
        walk.dieAns[prompt.req] = !!value;
        walk.pendingDie = prompt.label;
        trail(state, {
          kind: TRAIL.QUESTION,
          text: prompt.text,
          answer: value ? "Yes" : "No",
        });
        break;
      case PROMPT.RING:
        if (value) {
          state.board.rings = Math.max(0, state.board.rings - 1);
          state.ringUsedThisTurn = true;
          walk.dieAns[prompt.req] = true;
          walk.pendingDie = prompt.label;
          engine.log(
            state,
            "Elven Ring used to create " +
              dieWithArticle(prompt.req) +
              " die (rule 36).",
          );
          trail(state, {
            kind: TRAIL.RING,
            text: "Elven Ring used for " + dieWithArticle(prompt.req) + " die",
          });
        } else {
          walk.dieAns[prompt.req] = false;
          walk.pendingDie = prompt.label;
        }
        break;
      case PROMPT.ACTION: {
        if (value === "done") {
          trail(state, {
            kind: TRAIL.ACTION,
            text: prompt.text,
            answer: "done",
          });
          if (prompt.pass) {
            endWalk(state, WALK_RESULT.PASS, "Queller passes.");
            engine.log(state, "Queller passes.");
            break;
          }
          if (prompt.minion) {
            state.board.chars[prompt.minion] = true;
            state.playable = {};
            engine.log(
              state,
              walk.minionPick + " is now in play (tracker updated).",
            );
          }
          if (prompt.nation) {
            const now = state.board.nations[prompt.nation] ?? 0;
            state.board.nations[prompt.nation] = Math.max(0, now - 1);
            state.playable = {};
            engine.log(
              state,
              SHADOW_NATION_NAME[prompt.nation] +
                " is now " +
                engine.politicalTrackLabel(state.board.nations[prompt.nation]) +
                ".",
            );
          }
          if (prompt.faction) {
            state.board.factions[prompt.faction] = true;
            state.playable = {};
            engine.log(
              state,
              walk.factionChoice +
                " are now in play (tracker updated; the Faction die joins the pool next turn).",
            );
          }
          if (walk.die) spendCurrentDie(state, "“" + prompt.text + "”");
          else engine.log(state, "Queller: " + prompt.text);
          endWalk(state, WALK_RESULT.ACTION, prompt.text);
          break;
        }
        trail(state, {
          kind: TRAIL.ACTION,
          text: prompt.text,
          answer: "not possible",
        });
        exitAction(state);
        break;
      }
      case PROMPT.PLAY_CARD: {
        const palantirBefore = state.cards.table.includes(CARD.PALANTIR),
          die = walk.die;
        const card = engine.playCard(state, prompt.card, {
          combat: prompt.combat,
        });
        trail(state, {
          kind: TRAIL.ACTION,
          text: "Played “" + card.title + "”",
          answer: "done",
          card: prompt.card,
        });
        if (!prompt.combat && walk.die)
          spendCurrentDie(state, "played “" + card.title + "”"); // spent first so a card effect on the dice never touches the die that played it
        for (const entry of engine.resolveCardEffects(state, prompt.card, {
          combat: prompt.combat,
          die,
          palantirBefore,
        }))
          trail(state, entry);
        if (prompt.combat) {
          follow(state, null);
          break;
        }
        endWalk(
          state,
          WALK_RESULT.ACTION,
          "Queller plays “" + card.title + "”.",
        );
        break;
      }
      case PROMPT.STEP: {
        trail(state, {
          kind: TRAIL.STEP,
          text: prompt.text,
          answer: value === "no" ? "not possible" : "done",
        });
        if (prompt.move && value !== "no") walk.dieUsed = true;
        follow(state, null);
        break;
      }
      case PROMPT.ROLL: {
        trail(state, { kind: TRAIL.STEP, text: prompt.text, answer: value });
        follow(state, value);
        break;
      }
      case PROMPT.PRIORITY: {
        trail(state, {
          kind: TRAIL.PRIORITY,
          text: prompt.text,
          items: prompt.items,
          steps: prompt.steps,
          card: prompt.card,
          choice: prompt.choice,
        });
        follow(state, null);
        break;
      }
      case PROMPT.BATTLE_FORM: {
        state.battle = value;
        state.playable = Object.fromEntries(
          Object.entries(state.playable).filter(
            ([key]) => !key.startsWith("B:"),
          ),
        );
        trail(state, { kind: TRAIL.NOTE, text: "Battle details recorded" });
        break;
      }
    }
    run(state);
  }

  // ----- phase driver helpers -----
  function phasePage(state) {
    return state.strategy === STRATEGY.MILITARY ? "M14" : "C14";
  }
  function phase5Page(state) {
    return state.strategy === STRATEGY.MILITARY ? "M5" : "C5";
  }
  function startPhase(state, phase) {
    const page = phasePage(state);
    if (phase === PHASE.SETUP) {
      state.walk = null;
      startWalk(state, "C14", "Start of game");
      return;
    }
    if (phase === PHASE.P1) {
      state.phase = PHASE.P1;
      startWalk(state, page, "Phase 1");
      return;
    }
    if (phase === PHASE.P2) {
      state.phase = PHASE.P2;
      if (state.strategy === STRATEGY.CORRUPTION)
        startWalk(state, "C14", "Phase 2");
      return;
    }
    if (phase === PHASE.P3) {
      state.phase = PHASE.P3;
      startWalk(state, page, "Phase 3");
      return;
    }
    if (phase === PHASE.P4) {
      state.phase = PHASE.P4;
      startWalk(state, page, "Phase 4");
      return;
    }
    if (phase === PHASE.P5) {
      state.phase = PHASE.P5;
      startWalk(state, phase5Page(state), "Phase 5");
    }
  }
  function startBattle(state, round) {
    state.walk = null;
    beginWalk(state, "BA", round === 1 ? "Battle" : "Battle (next round)", {
      battleRound: round,
    });
    if (state.settings.cards) {
      state.walk.prompt = {
        type: PROMPT.BATTLE_FORM,
        round,
        text: "Battle details (used to judge which combat cards Queller can play)",
      };
    } else run(state);
  }
  function nextTurn(state) {
    state.turn++;
    state.phase = PHASE.P1;
    state.walk = null;
    state.situ = {};
    state.playable = {};
    state.battle = null;
    state.battleOpen = false;
    state.ringUsedThisTurn = false;
    engine.log(state, "— Turn " + state.turn + " —");
  }

  Object.assign(window.QB, {
    PROMPT,
    YES_NO_PROMPTS,
    WALK_RESULT,
    phaseResult,
    phaseFromResult,
    STRATEGY_ROLL,
    CARD_CRITERIA_NODES,
    startWalk,
    answer,
    run,
    startPhase,
    startBattle,
    nextTurn,
    jumpSpec,
    normalizeText,
    DIE_REQUIREMENT_NAME,
    findStart,
    phase5Page,
    phasePage,
  });
})();
