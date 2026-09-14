// ===== Queller Runner engine: state, dice, cards, playability =====
(function () {
  const CARDS = window.QB_CARDS;
  const cardById = {};
  // Initiative as a number: "3-5" counts as 4, no initiative as 0.
  function initiativeValue(card) {
    if (typeof card.init === "number") return card.init;
    return card.init === "3-5" ? 4 : 0;
  }
  CARDS.forEach((card) => {
    cardById[card.id] = card;
    card.initiative = initiativeValue(card);
  });
  const randomBelow = (limit) => Math.floor(Math.random() * limit);
  const pick = (items) => items[randomBelow(items.length)];
  const shuffle = (items) => {
    items = items.slice();
    for (let i = items.length - 1; i > 0; i--) {
      const j = randomBelow(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const VERSION = 59; // app version (shown in the debug log and stamped on saves)
  const PALANTIR = "sa045",
    BALROG = "sa001b2";
  const SHADOW_FACTIONS = ["corsairs", "dunlendings", "spiders"];
  const DIE_STATE = {
    POOL: "pool",
    HUNT: "hunt",
    AVAIL: "avail",
    USED: "used",
    RESERVED: "reserved",
  };

  // ---------- card flags ----------
  // Static flags come from cards.js; only `preferred` and `factionInPlay` depend on the game state.
  // The strategy's preferred card type: Character cards under corruption, any other type under military.
  function preferred(card, strategy) {
    if (!card.type) return false;
    return strategy === "corruption"
      ? card.type === "Character"
      : card.type !== "Character";
  }
  function cardFlags(card, state) {
    return {
      revealed: !!card.revealed,
      tile: !!card.tile,
      corruption: !!card.corruption,
      init: card.initiative,
      preferred: preferred(card, state.strategy),
      factionInPlay: card.faction
        ? !!state.board.factions[card.faction.toLowerCase()]
        : false,
    };
  }
  const FACTION_CAT = {
    sa_Faction01: "muster",
    sa_Faction02: "muster",
    sa_Faction03: "other",
    sa_Faction04: "attack",
    sa_Faction05: "attack",
    sa_Faction06: "muster",
    sa_Faction07: "muster",
    sa_Faction08: "attack",
    sa_Faction09: "attack",
    sa_Faction10: "other",
    sa_Faction11: "move",
    sa_Faction12: "move",
    sa_Faction13: "move",
    sa_Faction14: "other",
    sa_Faction15: "muster",
    sa_Faction16: "other",
    sa_Faction17: "other",
    sa_Faction18: "other",
    sa_Faction19: "other",
    sa_Faction20: "other",
  };
  const MUSTER_CHOICE = {
    sa015: 1,
    sa018: 1,
    sa027: 1,
    sa028b2: 1,
    sa028: 1,
    sa033: 1,
  };
  const staysOnTable = (id) => !!cardById[id].onTable;
  const handCardsOfDeck = (state, deckKey) =>
    state.cards.hand.filter((i) => cardById[i].deck === deckKey);
  // Cards Queller may use as a combat card: the hand, plus table cards whose text allows it (Balrog of Moria).
  const combatCandidates = (state) =>
    state.cards.hand.concat(
      state.cards.table.filter((i) => cardById[i].tableCombat),
    );
  const callToBattleCards = (state) =>
    CARDS.filter(
      (card) =>
        card.deck === "B" && state.board.factions[card.faction.toLowerCase()],
    ).map((card) => card.id);

  // ---------- board helpers ----------
  // Shadow nations on the Political Track: nations.sauron/isengard/se = steps above "At War" (0 = At War, 1-3 = Active +N). Start: Sauron 1, Isengard 1, state&E 2.
  const SHADOW_NATION_START = { sauron: 1, isengard: 1, se: 2 };
  function shadowNationAtWar(state, nation) {
    return (state.board.nations[nation] | 0) === 0;
  }
  function allShadowNationsAtWar(state) {
    return (
      shadowNationAtWar(state, "sauron") &&
      shadowNationAtWar(state, "isengard") &&
      shadowNationAtWar(state, "se")
    );
  }
  function politicalTrackLabel(steps) {
    return steps === 0 ? "At War" : "Active +" + steps;
  }
  function fpNationAtWar(state) {
    return ["gondor", "rohan", "north", "dwarves", "elves"].some(
      (nation) => state.board.nations[nation] === "war",
    );
  }
  function shadowFactionInPlay(state) {
    return (
      state.settings.wome &&
      SHADOW_FACTIONS.some((factionKey) => state.board.factions[factionKey])
    );
  }
  function allShadowFactionsInPlay(state) {
    return SHADOW_FACTIONS.every(
      (factionKey) => state.board.factions[factionKey],
    );
  }
  // Whether the app knows how many Elven Rings the Shadow holds: the full tracker has the field, and so does the minimal tracker when dice are rolled.
  function ringsKnown(state) {
    return !!(state.settings.tracker || state.settings.dice);
  }
  function ringAvailable(state) {
    return (
      !state.ringUsedThisTurn && (!ringsKnown(state) || state.board.rings > 0)
    );
  }
  // Hunt box maximum (rulebook: the number of Companions, but always at least one) — rule 34 caps the flowchart allocations at it.
  function huntCap(state) {
    return Math.max(1, state.board.fs.companions | 0);
  }
  // Minions Queller could muster now, in priority order (Muster page); the first is the one it musters.
  function minionsAvailable(state) {
    const chars = state.board.chars,
      out = [];
    if (shadowNationAtWar(state, "isengard") && !chars.saruman)
      out.push({ name: "Saruman", key: "saruman", why: "Isengard at war" });
    if (
      shadowNationAtWar(state, "sauron") &&
      fpNationAtWar(state) &&
      !chars.witchKing
    )
      out.push({
        name: "Witch King",
        key: "witchKing",
        why: "Sauron at war and a Free Peoples nation at war",
      });
    if (allShadowNationsAtWar(state) && !chars.mouth)
      out.push({
        name: "Mouth of Sauron",
        key: "mouth",
        why: "all Shadow nations at war",
      });
    return out;
  }
  // Older saves kept the Shadow nations as booleans (true = at war); now they are steps above At War.
  function migrateNations(nations) {
    for (const nation of ["sauron", "isengard", "se"]) {
      if (typeof nations[nation] === "boolean")
        nations[nation] = nations[nation] ? 0 : SHADOW_NATION_START[nation];
      else if (typeof nations[nation] !== "number")
        nations[nation] = SHADOW_NATION_START[nation];
    }
  }
  function migrate(save) {
    if (save.settings && save.settings.tracker === undefined) {
      save.settings.tracker = save.settings.walk !== false;
      delete save.settings.walk;
    }
    if (save.board?.nations) migrateNations(save.board.nations);
    if (save.board && save.board.rings === undefined) save.board.rings = 0;
    delete save.shownCard;
    delete save.lastAction;
    return save;
  }

  // ---------- playability preconditions ----------
  // Each returns true/false, or asks a situational question (answered once per turn) via situationalAnswer().
  const SITUATIONAL_QUESTIONS = {
    mtSiege: "Is Minas Tirith under siege by a Shadow army?",
    nazNearFP:
      "Is a Shadow army containing Nazgûl adjacent to, or in the same region as, a Free Peoples army?",
    wkBesieging:
      "Is the Witch-king with a Shadow army that is besieging a Stronghold?",
    isenBesieging:
      "Is an army containing an Isengard unit besieging a Stronghold?",
    elvenStronghold: "Does the Shadow control at least one Elven Stronghold?",
    fpNotWar:
      "Is the Fellowship or a Companion inside the borders of a Free Peoples nation that is not at war?",
    siegeEngine: "Is a Shadow Siege Engine in this battle?",
  };
  function situationalAnswer(state, key) {
    const answer = state.situ[key];
    if (answer === undefined)
      return { situ: key, q: SITUATIONAL_QUESTIONS[key] };
    return answer;
  }
  const PRECONDITIONS = {
    fsNotInFPSettlement: (state) => !state.board.fs.inFPSettlement,
    fsProgress1: (state) => state.board.fs.progress >= 1,
    fsRevealed: (state) => state.board.fs.revealed,
    saruman: (state) => state.board.chars.saruman,
    witchKing: (state) => state.board.chars.witchKing,
    aragorn: (state) => state.board.chars.aragorn,
    isengardAtWar: (state) => shadowNationAtWar(state, "isengard"),
    sauronAtWar: (state) => shadowNationAtWar(state, "sauron"),
    seAtWar: (state) => shadowNationAtWar(state, "se"),
    allAtWar: allShadowNationsAtWar,
    dunlendings: (state) => state.board.factions.dunlendings,
    corsairs: (state) => state.board.factions.corsairs,
    fpFaction: (state) => {
      const factions = state.board.factions;
      return factions.ents || factions.eagles || factions.deadmen;
    },
    mtSiege: (state) => situationalAnswer(state, "mtSiege"),
    nazNearFP: (state) => situationalAnswer(state, "nazNearFP"),
    elvenStronghold: (state) => situationalAnswer(state, "elvenStronghold"),
    fpNotWar: (state) => situationalAnswer(state, "fpNotWar"),
    wkBesieging: (state) =>
      state.board.chars.witchKing
        ? situationalAnswer(state, "wkBesieging")
        : false,
    isenBesieging: (state) =>
      state.board.chars.saruman
        ? situationalAnswer(state, "isenBesieging")
        : false,
    // The Lidless Eye has no effect without an unused die (rule 17); only checkable when the app rolls the dice.
    unusedDice: (state) =>
      !state.settings.dice ||
      availableDice(state).some(
        (die) =>
          die.k === "A" &&
          !(state.walk && state.dice.pool.indexOf(die) === state.walk.dieObj),
      ),
  };
  function precondition(state, cardId) {
    const key = cardById[cardId].pre;
    return key ? PRECONDITIONS[key](state) : true;
  }
  // combat-card precondition from the battle form
  const COMBAT_PRECONDITIONS = {
    nazLead1: (state, battle) => (battle.nazLead | 0) >= 1,
    nazLead2: (state, battle) => (battle.nazLead | 0) >= 2,
    nazInBattle: (state, battle) => (battle.nazLead | 0) > 0,
    siegeEngine: (state) => situationalAnswer(state, "siegeEngine"),
    isengardStronghold: (state, battle) => !!battle.isengardStronghold,
    seElite: (state, battle) => !!battle.seElite,
    shadowElite: (state, battle) => !!battle.shadowElite,
    nearMoria: (state, battle) => !!battle.nearMoria,
    defInFs: (state, battle) => !!battle.defInFs,
    ctb: () => true,
    ctbNotBesieged: (state, battle) => !battle.underSiege,
    ctbAttackingSiege: (state, battle) => !!battle.attackingSiege,
  };
  function combatPrecondition(state, card) {
    const battle = state.battle || {};
    if (card.deck === "B") {
      const factionKey = card.faction.toLowerCase();
      if (!state.board.factions[factionKey] || !battle.figures?.[factionKey])
        return false;
    }
    return card.cpre ? COMBAT_PRECONDITIONS[card.cpre](state, battle) : true;
  }

  // ---------- initial state ----------
  function newState(settings) {
    const state = {
      appVersion: VERSION,
      createdVersion: VERSION, // appVersion: the version that last saved this game; createdVersion: the one that created it
      settings: {
        dice: true,
        cards: true,
        tracker: true,
        wome: true,
        ...settings,
      },
      turn: 1,
      strategy: null,
      phase: "setup",
      dice: { pool: [], base: 7, hunt: 0, factionDie: false },
      cards: {
        decks: { C: [], S: [], F: [] },
        discards: { C: [], S: [], F: [] },
        hand: [],
        factionHand: [],
        table: [],
        factionTable: [],
      },
      board: {
        fs: {
          progress: 0,
          revealed: false,
          mordor: false,
          inFPSettlement: true,
          inStrongholdOrSea: true,
          atStart: true,
          guideGollum: false,
          companions: 7,
        },
        chars: {
          saruman: false,
          witchKing: false,
          mouth: false,
          gandalfWhite: false,
          aragorn: false,
        },
        nations: {
          sauron: 1,
          isengard: 1,
          se: 2,
          gondor: "passive",
          rohan: "passive",
          north: "passive",
          dwarves: "passive",
          elves: "active",
        },
        factions: {
          corsairs: false,
          dunlendings: false,
          spiders: false,
          ents: false,
          eagles: false,
          deadmen: false,
        },
        nazgul: 4,
        shadowVP: 0,
        corruption: 0,
        rings: 0,
      },
      ringUsedThisTurn: false,
      situ: {},
      playable: {},
      battle: null,
      battleOpen: false,
      minionReserved: false,
      walk: null,
      log: [],
    };
    buildDecks(state);
    return state;
  }
  // Whether a card goes into this game's decks: Call to Battle cards never do, WoME cards only with the expansion, and the two cards
  // that have a base-game and a WoME version (sa028/sa038 and their b2 twins) contribute whichever version applies.
  function inDecks(card, wome) {
    if (card.deck === "B") return false;
    if (card.set === "WoME" && !wome) return false;
    if (card.id === "sa028b2" || card.id === "sa038b2") return !wome;
    if (card.id === "sa028" || card.id === "sa038") return wome;
    return true;
  }
  function buildDecks(state) {
    const wome = state.settings.wome;
    const decks = { C: [], S: [], F: [] };
    for (const card of CARDS)
      if (inDecks(card, wome) && decks[card.deck])
        decks[card.deck].push(card.id);
    state.cards.decks = {
      C: shuffle(decks.C),
      S: shuffle(decks.S),
      F: shuffle(decks.F),
    };
  }

  // ---------- dice ----------
  const SHADOW_FACES = [
    "Muster",
    "Army/Muster",
    "Army",
    "Character",
    "Event",
    "Eye",
  ];
  const FACTION_FACES = [
    "Recruit",
    "Play/Draw",
    "Recruit/Play",
    "Recruit/Draw",
    "Eye",
    "Wild",
  ];
  function diceCount(state) {
    const chars = state.board.chars;
    return (
      7 +
      (chars.saruman ? 1 : 0) +
      (chars.witchKing ? 1 : 0) +
      (chars.mouth ? 1 : 0)
    );
  }
  function recoverDice(state) {
    const count = diceCount(state);
    state.dice.pool = [];
    state.dice.hunt = 0;
    for (let i = 0; i < count; i++)
      state.dice.pool.push({ k: "A", face: null, st: DIE_STATE.POOL });
    // WoME p.8: the Faction die joins the pool at the start of the turn after the first Shadow Faction enters play, and leaves it the turn after the last one is gone.
    state.dice.factionDie = shadowFactionInPlay(state);
    if (state.dice.factionDie)
      state.dice.pool.push({ k: "F", face: null, st: DIE_STATE.POOL });
    state.minionReserved = false;
    state.ringUsedThisTurn = false;
    state.situ = {};
    state.playable = {};
    log(
      state,
      "Recovered " +
        count +
        " action dice" +
        (state.dice.factionDie ? " and the Faction die" : "") +
        ".",
    );
  }
  function assignHunt(state, requested) {
    const pool = state.dice.pool.filter(
      (die) => die.k === "A" && die.st === DIE_STATE.POOL,
    );
    const cap = huntCap(state),
      placed = Math.min(requested, cap, pool.length);
    for (let i = 0; i < placed; i++) {
      pool[i].st = DIE_STATE.HUNT;
      pool[i].face = "Eye";
    }
    state.dice.hunt += placed;
    log(
      state,
      "Placed " +
        placed +
        " " +
        (placed === 1 ? "die" : "dice") +
        " in the Hunt box before rolling" +
        (placed < requested && cap < requested
          ? " (rule 34: maximum " +
            cap +
            " for " +
            (state.board.fs.companions | 0) +
            " Companions)"
          : "") +
        ".",
    );
    return placed;
  }
  function rollRemaining(state) {
    let eyes = 0;
    const out = [];
    for (const die of state.dice.pool) {
      if (die.st !== DIE_STATE.POOL) continue;
      die.face = die.k === "A" ? pick(SHADOW_FACES) : pick(FACTION_FACES);
      if (die.face === "Eye") {
        die.st = DIE_STATE.HUNT;
        state.dice.hunt++;
        eyes++;
      } else die.st = DIE_STATE.AVAIL;
      out.push(die.face);
    }
    let hunt = "";
    if (eyes)
      hunt = " — " + eyes + " Eye" + (eyes > 1 ? "s" : "") + " to the Hunt box";
    log(state, "Rolled: " + out.join(", ") + hunt + ".");
    return out;
  }
  function preferredFaces(state) {
    return state.strategy === "corruption"
      ? ["Character"]
      : ["Army", "Muster", "Army/Muster"];
  }
  // which available dice satisfy a requirement
  const DIE_REQUIREMENT_FACES = {
    Army: ["Army", "Army/Muster", "Wild"],
    Muster: ["Muster", "Army/Muster", "Wild"],
    Character: ["Character", "Wild"],
    Event: ["Event", "Wild"],
    CharOrMuster: ["Character", "Muster", "Army/Muster", "Wild"],
    FRecruit: ["Recruit", "Recruit/Play", "Recruit/Draw", "Wild"],
    FPlay: ["Play/Draw", "Recruit/Play", "Wild"],
    FDraw: ["Play/Draw", "Recruit/Draw", "Wild"],
  };
  // Does a die already held for `have` satisfy a step that needs `need`?
  function dieSatisfies(have, need) {
    return (
      !!have &&
      (have === need ||
        (need === "CharOrMuster" &&
          (have === "Character" || have === "Muster")))
    );
  }
  function availableDice(state) {
    return state.dice.pool.filter((die) => die.st === DIE_STATE.AVAIL);
  }
  function findDie(state, req) {
    const faces = DIE_REQUIREMENT_FACES[req] || [req];
    const available = availableDice(state);
    for (const face of faces) {
      const die = available.find((candidate) => candidate.face === face);
      if (die) return die;
    }
    return null;
  }
  function spendDie(state, die, why) {
    if (!die) return;
    die.st = DIE_STATE.USED;
    log(
      state,
      "Used the " + die.face + " die" + (why ? " — " + why : "") + ".",
    );
  }
  // rule 36 / 23 selection: at random from the dice that do not show a preferred result; from all dice if every die does
  function nonPreferredFirst(state, dice, count) {
    const preferredResults = preferredFaces(state);
    let candidates = dice.filter((die) => !preferredResults.includes(die.face));
    if (!candidates.length) candidates = dice.slice();
    const out = [];
    while (out.length < count && candidates.length) {
      const i = randomBelow(candidates.length);
      out.push(candidates.splice(i, 1)[0]);
    }
    return out;
  }
  function ringChange(state, req) {
    // rule 36: change one non-preferred available die to the required result
    const available = availableDice(state).filter((die) => die.k === "A");
    if (!available.length) return null;
    const die = nonPreferredFirst(state, available, 1)[0];
    const from = die.face;
    let face = req;
    if (req === "CharOrMuster") face = "Character";
    else if (req.startsWith("F")) face = "Wild";
    die.face = face;
    state.board.rings = Math.max(0, state.board.rings - 1);
    state.ringUsedThisTurn = true;
    log(
      state,
      "Used an Elven Ring: changed a " +
        from +
        " die to " +
        die.face +
        " (rule 36). Rings left: " +
        state.board.rings +
        ".",
    );
    return die;
  }

  // ---------- cards ----------
  function drawCard(state, deckKey) {
    const deck = state.cards.decks[deckKey];
    if (!deck.length) {
      const discards = state.cards.discards[deckKey];
      if (!discards.length) {
        log(state, "The " + deckName(deckKey) + " deck is empty.");
        return null;
      }
      state.cards.decks[deckKey] = shuffle(discards);
      state.cards.discards[deckKey] = [];
      log(
        state,
        "Reshuffled the " + deckName(deckKey) + " discards into a new deck.",
      );
    }
    const id = state.cards.decks[deckKey].shift();
    if (deckKey === "F") state.cards.factionHand.push(id);
    else state.cards.hand.push(id);
    log(
      state,
      "Drew a " +
        deckName(deckKey) +
        " card (" +
        (deckKey === "F"
          ? state.cards.factionHand.length
          : state.cards.hand.length) +
        " in hand).",
    );
    return id;
  }
  function deckName(deckKey) {
    if (deckKey === "C") return "Character";
    return deckKey === "S" ? "Strategy" : "Faction Event";
  }
  function handCounts(state) {
    return {
      character: handCardsOfDeck(state, "C").length,
      strategy: handCardsOfDeck(state, "S").length,
      total: state.cards.hand.length,
      faction: state.cards.factionHand.length,
    };
  }
  function removeFromLists(state, id) {
    for (const list of [
      state.cards.hand,
      state.cards.factionHand,
      state.cards.table,
      state.cards.factionTable,
    ]) {
      const i = list.indexOf(id);
      if (i >= 0) {
        list.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  function discardCard(state, id, why) {
    const card = cardById[id];
    removeFromLists(state, id);
    state.cards.discards[card.deck].push(id);
    log(
      state,
      "Discarded “" + card.title + "”" + (why ? " — " + why : "") + ".",
      {
        card: id,
      },
    );
  }
  function playCard(state, id, play) {
    const card = cardById[id];
    const combat = !!play?.combat;
    removeFromLists(state, id);
    const onTable = staysOnTable(id) && !combat;
    if (onTable) {
      (card.deck === "F" ? state.cards.factionTable : state.cards.table).push(
        id,
      );
    } else if (card.deck !== "B") state.cards.discards[card.deck].push(id);
    delete state.playable[(combat ? "B:" : "") + id];
    log(
      state,
      (combat ? "Combat card: " : "Played: ") +
        "“" +
        card.title +
        "”" +
        (onTable ? " (stays on the table)" : "") +
        ".",
      { card: id, combat },
    );
    return card;
  }
  // Card effects that change Queller's hand, dice or board and are not steps on a flowchart page. Returns trail entries.
  const FACTION_PICK = ["Preferred card", "Faction in play"]; // rule 3 breaks the tie
  function resolveCardEffects(state, id, play) {
    const card = cardById[id];
    const out = [];
    if (play?.combat) return out;
    const cards = state.cards;
    if (card.effect === "servants") {
      if (cards.decks.F.length < 3 && cards.discards.F.length) {
        cards.decks.F = cards.decks.F.concat(shuffle(cards.discards.F));
        cards.discards.F = [];
      }
      const drawn = cards.decks.F.splice(0, 3);
      const picked = applyPriority(state, drawn, FACTION_PICK);
      if (picked.chosen) {
        cards.factionHand.push(picked.chosen);
      }
      const rest = drawn.filter((id) => id !== picked.chosen);
      cards.decks.F = shuffle(cards.decks.F.concat(rest, cards.discards.F));
      cards.discards.F = [];
      log(
        state,
        "Servants of Sauron: drew " +
          drawn.length +
          " Faction Event cards, kept one, reshuffled the rest and the discards into the deck.",
      );
      out.push({
        kind: "pri",
        text: "Servants of Sauron — keep one of " + drawn.length + " cards",
        items: FACTION_PICK.concat("Otherwise at random (rule 3)"),
        steps: picked.steps,
        card: picked.chosen,
      });
    } else if (card.effect === "hisWill") {
      const picked = applyPriority(
        state,
        cards.discards.F.filter((other) => other !== id),
        FACTION_PICK,
      );
      if (picked.chosen) {
        cards.discards.F.splice(cards.discards.F.indexOf(picked.chosen), 1);
        cards.factionHand.push(picked.chosen);
        log(
          state,
          "His Will and His Malice: “" +
            cardById[picked.chosen].title +
            "” returned from the discard pile to the hand.",
        );
      } else
        log(
          state,
          "His Will and His Malice: no Faction Event card in the discard pile.",
        );
      out.push({
        kind: "pri",
        text: "His Will and His Malice — take a card from the Faction discard pile",
        items: FACTION_PICK.concat("Otherwise at random (rule 3)"),
        steps: picked.chosen ? picked.steps : ["Discard pile empty"],
        card: picked.chosen,
      });
    } else if (card.effect === "lidlessEye" && state.settings.dice) {
      const chosen = nonPreferredFirst(
        state,
        availableDice(state).filter((die) => die.k === "A"),
        3,
      );
      const from = chosen.map((die) => die.face);
      for (const die of chosen) {
        die.face = "Eye";
        die.st = DIE_STATE.HUNT;
        state.dice.hunt++;
      }
      let logText = "no unused die to change.",
        noteText = "no unused die to change";
      if (chosen.length) {
        const one = chosen.length === 1;
        logText =
          "changed " +
          from.join(", ") +
          " to Eye and placed " +
          (one ? "it" : "them") +
          " in the Hunt box.";
        noteText =
          chosen.length +
          " " +
          (one ? "die" : "dice") +
          " (" +
          from.join(", ") +
          ") to the Hunt box, non-preferred results first (rule 23)";
      }
      log(state, "The Lidless Eye: " + logText);
      out.push({ kind: "note", text: "The Lidless Eye: " + noteText });
    } else if (card.effect === "recruitFaction") {
      const factionKey = card.faction.toLowerCase();
      if (!state.board.factions[factionKey]) {
        state.board.factions[factionKey] = true;
        state.playable = {};
        log(
          state,
          card.faction +
            " are now in play (tracker updated; the Faction die joins the pool next turn).",
        );
        out.push({
          kind: "note",
          text: card.faction + " enter play — tracker updated",
        });
      }
    }
    // The Palantír of Orthanc: after an Event die plays an Event card, draw another card (a preferred one: Character under the corruption strategy, Strategy under military).
    if (
      play?.die === "Event" &&
      (card.deck === "C" || card.deck === "S") &&
      play.palantirBefore
    ) {
      const deckKey = state.strategy === "corruption" ? "C" : "S";
      const got = drawCard(state, deckKey);
      log(
        state,
        "The Palantír of Orthanc: drew a " +
          deckName(deckKey) +
          " card after playing “" +
          card.title +
          "” with an Event die.",
      );
      out.push({
        kind: "note",
        text:
          "The Palantír of Orthanc: drew a " +
          deckName(deckKey) +
          " card" +
          (got ? "" : " — deck empty"),
      });
    }
    return out;
  }
  // Table cards whose discard condition the board tracker can see. `check` returns true (discard now), false, or a question to ask the player.
  const TABLE_TRIGGERS = [
    {
      id: "sa051",
      check: (state, change) => {
        if (change.key === "chars.saruman" && !change.to)
          return "Saruman eliminated";
        if (
          change.key === "nations.rohan" &&
          change.from === "passive" &&
          change.to !== "passive"
        )
          return "Rohan activated";
        return false;
      },
    },
    {
      id: PALANTIR,
      check: (state, change) =>
        change.key === "chars.saruman" && !change.to
          ? "Saruman eliminated"
          : false,
    },
    {
      id: "sa050",
      check: (state, change) => {
        if (!/^nations\.(gondor|rohan|north|dwarves|elves)$/.test(change.key))
          return false;
        const rank = { passive: 0, active: 1, war: 2 };
        if (rank[change.to] <= rank[change.from]) return false;
        if (change.from === "passive")
          return "a Free Peoples nation advanced from passive (only an attack, a Companion or a Fellowship declaration can do that while the card is in play)";
        return {
          q: "Threats and Promises: did the nation go to war because of an attack or a Companion’s special ability (not a Muster die)?",
        };
      },
    },
    {
      id: "sa009",
      check: (state, change) =>
        fsDeclaredInFP(state, change)
          ? {
              q: "Flocks of Crebain: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
            }
          : false,
    },
    {
      id: "sa052",
      check: (state, change) =>
        fsDeclaredInFP(state, change)
          ? {
              q: "Worn with Sorrow and Toil: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
            }
          : false,
    },
  ];
  function fsDeclaredInFP(state, change) {
    return (
      (change.key === "fs.revealed" || change.key === "fs.inFPSettlement") &&
      !!change.to &&
      state.board.fs.revealed &&
      state.board.fs.inFPSettlement
    );
  }
  // After a tracker change {key, from, to}: discards the table cards whose condition is now met; returns the questions the app cannot answer itself.
  function tableTriggers(state, change) {
    const asks = [];
    for (const trigger of TABLE_TRIGGERS) {
      if (!state.cards.table.includes(trigger.id)) continue;
      const outcome = trigger.check(state, change);
      if (!outcome) continue;
      if (typeof outcome === "string") discardCard(state, trigger.id, outcome);
      else asks.push({ card: trigger.id, q: outcome.q });
    }
    return asks;
  }
  // priority-list filtering (rules 30, 31)
  // The cards a criterion keeps: those its predicate accepts, or for a rank spec the best-ranked of the cards `only` selects
  // (the cards it does not select are kept alongside the best).
  function narrow(opts, test) {
    if (!test.rank) return opts.filter((id) => test(cardById[id]));
    const ranked = opts.filter((id) => !test.only || test.only(cardById[id]));
    let best = null;
    for (const id of ranked) {
      const value = test.rank(cardById[id]);
      if (best === null || (test.max ? value > best : value < best))
        best = value;
    }
    return opts.filter(
      (id) => !ranked.includes(id) || test.rank(cardById[id]) === best,
    );
  }
  function applyPriority(state, ids, criteria, play) {
    let opts = ids.slice();
    const steps = [];
    const eventHandFull = state.cards.hand.length >= 6,
      factionHandFull = state.cards.factionHand.length >= 4;
    for (const crit of criteria) {
      if (opts.length <= 1) break;
      const test = criterionTest(crit, state, play, {
        eventFull: eventHandFull,
        factionFull: factionHandFull,
      });
      if (!test) {
        steps.push(crit + " → not a card criterion, skipped");
        continue;
      }
      const kept = narrow(opts, test);
      if (kept.length > 0 && kept.length < opts.length) {
        steps.push(crit + " → " + kept.length + " left");
        opts = kept;
      } else if (kept.length === 0) steps.push(crit + " → no card, skipped");
    }
    let chosen;
    if (opts.length > 1) {
      chosen = pick(opts);
      steps.push(
        "Tie between " + opts.length + " cards — chosen at random (rule 3)",
      );
    } else chosen = opts[0] || null;
    return { chosen, steps };
  }
  const notCallToBattle = (card) => card.deck !== "B"; // rule 19: Call to Battle cards ignore initiative
  // The card criteria of the priority lists, matched in order (a longer phrase before the phraseStartsWith it shares). Each entry builds a predicate
  // on a card, or a rank spec {rank, max, only} that applyPriority resolves; flagsOf(card) is the card's flags for this game, handLimits the hand-limit facts.
  const phraseIs = (phrase) => (text) => text === phrase,
    phraseStartsWith = (phrase) => (text) => text.startsWith(phrase);
  const fullHand = (card, handLimits) =>
    card.deck === "F" ? handLimits.factionFull : handLimits.eventFull;
  const CRITERIA = [
    [
      phraseStartsWith("doesn't use the term"),
      (flagsOf) => (card) => !flagsOf(card).revealed,
    ],
    [
      phraseStartsWith("doesn't place a tile or add corruption"),
      (flagsOf) => (card) => !flagsOf(card).tile && !flagsOf(card).corruption,
    ],
    [
      phraseStartsWith("doesn't place a tile"),
      (flagsOf) => (card) => !flagsOf(card).tile,
    ],
    [phraseIs("strategy card"), () => (card) => card.deck === "S"],
    [phraseIs("character card"), () => (card) => card.deck === "C"],
    [
      phraseStartsWith("descending order"),
      (flagsOf) => ({
        rank: (card) => flagsOf(card).init,
        max: true,
        only: notCallToBattle,
      }),
    ],
    [
      phraseStartsWith("ascending order of initiative on character"),
      (flagsOf) => ({
        rank: (card) => flagsOf(card).init,
        max: false,
        only: (card) => card.deck === "C",
      }),
    ],
    [
      phraseStartsWith("ascending order"),
      (flagsOf) => ({
        rank: (card) => flagsOf(card).init,
        max: false,
        only: notCallToBattle,
      }),
    ],
    [phraseIs("no faction picture"), () => (card) => !card.faction],
    [
      phraseIs("faction not in play"),
      (flagsOf) => (card) => !!card.faction && !flagsOf(card).factionInPlay,
    ],
    [
      phraseIs("faction in play"),
      (flagsOf) => (card) => flagsOf(card).factionInPlay,
    ],
    [
      phraseIs("not preferred card"),
      (flagsOf) => (card) => !flagsOf(card).preferred,
    ],
    [
      phraseIs("preferred card"),
      (flagsOf) => (card) => flagsOf(card).preferred,
    ],
    [
      phraseIs("preferred event card"),
      (flagsOf) => (card) => flagsOf(card).preferred && card.deck !== "F",
    ],
    [
      phraseIs("preferred faction event card"),
      (flagsOf) => (card) => flagsOf(card).preferred && card.deck === "F",
    ],
    [
      phraseIs("full hand with preferred card"),
      (flagsOf, handLimits) => (card) =>
        flagsOf(card).preferred && fullHand(card, handLimits),
    ],
    [
      phraseIs("full hand"),
      (flagsOf, handLimits) => (card) => fullHand(card, handLimits),
    ],
    [
      phraseIs("event card"),
      () => (card) => card.deck === "C" || card.deck === "S",
    ],
    [phraseIs("faction event card"), () => (card) => card.deck === "F"],
    [
      phraseStartsWith("strategy card which cancels"),
      () => (card) => card.deck === "S" && card.ct === "Swarm of Bats",
    ],
    [phraseIs("durin's bane"), () => (card) => card.ct === "Durin's Bane"],
    [phraseIs("call to battle card"), () => (card) => card.deck === "B"],
    [
      phraseIs("mobile army attacks target"),
      () => (card) => FACTION_CAT[card.id] === "attack",
    ],
    [
      phraseIs("moves mobile army"),
      () => (card) => FACTION_CAT[card.id] === "move",
    ],
    [phraseIs("muster"), () => (card) => FACTION_CAT[card.id] === "muster"],
  ];
  function criterionTest(crit, state, play, handLimits) {
    const flagsOf = (card) => cardFlags(card, state);
    const phrase = crit.replaceAll("*", "").toLowerCase();
    const entry = CRITERIA.find(([matches]) => matches(phrase));
    return entry ? entry[1](flagsOf, handLimits) : null;
  }
  function autoDiscard(state, criteria, deckKey) {
    // discard down to the limit using a priority list (discard = the card that best fits)
    const limit = deckKey === "F" ? 4 : 6;
    const hand = deckKey === "F" ? state.cards.factionHand : state.cards.hand;
    const done = [];
    let guard = 0;
    while (hand.length > limit && guard++ < 10) {
      const picked = applyPriority(state, hand.slice(), criteria);
      if (!picked.chosen) break;
      discardCard(
        state,
        picked.chosen,
        "hand above the limit; " + picked.steps.join("; "),
      );
      done.push(picked.chosen);
    }
    return done;
  }

  function log(state, text, extra) {
    state.log.push({ t: text, turn: state.turn, ...extra });
    if (state.log.length > 400) state.log.shift();
  }

  window.QB = {
    VERSION,
    PALANTIR,
    BALROG,
    SHADOW_FACTIONS,
    DIE_STATE,
    SHADOW_NATION_START,
    shadowNationAtWar,
    allShadowNationsAtWar,
    politicalTrackLabel,
    fpNationAtWar,
    shadowFactionInPlay,
    allShadowFactionsInPlay,
    ringsKnown,
    ringAvailable,
    huntCap,
    minionsAvailable,
    migrate,
    CARDS,
    cardById,
    randomBelow,
    pick,
    shuffle,
    cardFlags,
    FACTION_CAT,
    MUSTER_CHOICE,
    staysOnTable,
    handCardsOfDeck,
    combatCandidates,
    callToBattleCards,
    SITUATIONAL_QUESTIONS,
    precondition,
    combatPrecondition,
    newState,
    buildDecks,
    SHADOW_FACES,
    FACTION_FACES,
    diceCount,
    recoverDice,
    assignHunt,
    rollRemaining,
    preferredFaces,
    DIE_REQUIREMENT_FACES,
    dieSatisfies,
    availableDice,
    findDie,
    spendDie,
    ringChange,
    drawCard,
    deckName,
    handCounts,
    discardCard,
    playCard,
    applyPriority,
    criterionTest,
    autoDiscard,
    resolveCardEffects,
    tableTriggers,
    log,
  };
})();
