// ===== Queller Runner engine: state, dice, cards, playability =====
import { CARDS } from "./cards/index.js";

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

// The values are what saved games and cards.js hold, so they must not change without a migrate() step.
const STRATEGY = { CORRUPTION: "corruption", MILITARY: "military" };
const PHASE = {
  SETUP: "setup",
  P1: "p1",
  P2: "p2",
  P3: "p3",
  P4: "p4",
  P5: "p5",
  P6: "p6",
};
// Card decks (the `deck` field of a card and the keys of cards.decks / cards.discards).
const DECK = {
  CHARACTER: "C",
  STRATEGY: "S",
  FACTION: "F",
  CALL_TO_BATTLE: "B",
};
// Queller's two hands: the Event hand (Character and Strategy cards) and the Faction Event hand.
const HAND = { EVENT: "E", FACTION: "F" };
const HAND_LIMIT = { [HAND.EVENT]: 6, [HAND.FACTION]: 4 };
const DIE_KIND = { ACTION: "A", FACTION: "F" };
const DIE_STATE = {
  POOL: "pool",
  HUNT: "hunt",
  AVAIL: "avail",
  USED: "used",
  RESERVED: "reserved",
};
const FACE = {
  MUSTER: "Muster",
  ARMY_MUSTER: "Army/Muster",
  ARMY: "Army",
  CHARACTER: "Character",
  EVENT: "Event",
  EYE: "Eye",
  RECRUIT: "Recruit",
  PLAY_DRAW: "Play/Draw",
  RECRUIT_PLAY: "Recruit/Play",
  RECRUIT_DRAW: "Recruit/Draw",
  WILD: "Wild",
};
// What a flowchart step needs a die to show (the `die` of a jump or action box).
const DIE_REQUIREMENT = {
  ARMY: "Army",
  MUSTER: "Muster",
  CHARACTER: "Character",
  EVENT: "Event",
  CHAR_OR_MUSTER: "CharOrMuster",
  FACTION_RECRUIT: "FRecruit",
  FACTION_PLAY: "FPlay",
  FACTION_DRAW: "FDraw",
};
const FACTION_REQUIREMENTS = [
  DIE_REQUIREMENT.FACTION_RECRUIT,
  DIE_REQUIREMENT.FACTION_PLAY,
  DIE_REQUIREMENT.FACTION_DRAW,
];
const isFactionRequirement = (req) => FACTION_REQUIREMENTS.includes(req);
// Free Peoples nations on the Political Track.
const FP_STANCE = { PASSIVE: "passive", ACTIVE: "active", WAR: "war" };
const FP_STANCE_RANK = {
  [FP_STANCE.PASSIVE]: 0,
  [FP_STANCE.ACTIVE]: 1,
  [FP_STANCE.WAR]: 2,
};
const SHADOW_NATIONS = ["sauron", "isengard", "se"];
const FP_NATIONS = ["gondor", "rohan", "north", "dwarves", "elves"];
const SHADOW_FACTIONS = ["corsairs", "dunlendings", "spiders"];
// Cards the engine or the UI single out by id.
const CARD = {
  PALANTIR: "sa045",
  BALROG: "sa001b2",
  WORMTONGUE: "sa051",
  THREATS_AND_PROMISES: "sa050",
  FLOCKS_OF_CREBAIN: "sa009",
  WORN_WITH_SORROW: "sa052",
  BLACK_SAILS: "sa_Faction03",
};
// The `effect` flag of a card: an effect the engine resolves itself when the card is played.
const CARD_EFFECT = {
  SERVANTS: "servants",
  HIS_WILL: "hisWill",
  LIDLESS_EYE: "lidlessEye",
  RECRUIT_FACTION: "recruitFaction",
};
// The kinds of entry in a walk's trail (the walker writes most of them; the engine adds entries for card effects).
const TRAIL = {
  START: "start",
  QUESTION: "q",
  PRIORITY: "pri",
  JUMP: "jump",
  SKIP: "skip",
  RETURN: "ret",
  BACK: "back",
  NOTE: "note",
  RING: "ring",
  STEP: "step",
  ACTION: "act",
  REVEAL: "reveal",
  END: "end",
};
const BASE_ACTION_DICE = 7; // the Shadow's dice before any minion joins
const STARTING_COMPANIONS = 7;
const LOG_CAP = 400; // log entries kept in the game state
const SERVANTS_DRAW = 3; // Faction Event cards Servants of Sauron looks at
const LIDLESS_EYE_DICE = 3; // dice The Lidless Eye turns to Eyes
const DISCARD_GUARD = 10; // at most this many discards in one hand-limit check

// Static flags come from cards.js; only `preferred` and `factionInPlay` depend on the game state.
// The strategy's preferred card type: Character cards under corruption, any other type under military.
function preferred(card, strategy) {
  if (!card.type) return false;
  return strategy === STRATEGY.CORRUPTION
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
      card.deck === DECK.CALL_TO_BATTLE &&
      state.board.factions[card.faction.toLowerCase()],
  ).map((card) => card.id);

// Shadow nations on the Political Track: nations.sauron/isengard/se = steps above "At War" (0 = At War, 1-3 = Active +N). Start: Sauron 1, Isengard 1, S&E 2.
const SHADOW_NATION_START = { sauron: 1, isengard: 1, se: 2 };
function shadowNationAtWar(state, nation) {
  return (state.board.nations[nation] ?? 0) === 0;
}
function allShadowNationsAtWar(state) {
  return SHADOW_NATIONS.every((nation) => shadowNationAtWar(state, nation));
}
function politicalTrackLabel(steps) {
  return steps === 0 ? "At War" : "Active +" + steps;
}
function fpNationAtWar(state) {
  return FP_NATIONS.some(
    (nation) => state.board.nations[nation] === FP_STANCE.WAR,
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
  return Math.max(1, state.board.fs.companions ?? 0);
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
  for (const nation of SHADOW_NATIONS) {
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
  const answer = state.situational[key];
  if (answer === undefined) return { key, q: SITUATIONAL_QUESTIONS[key] };
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
        die.kind === DIE_KIND.ACTION &&
        !(state.walk && state.dice.pool.indexOf(die) === state.walk.dieIndex),
    ),
};
function precondition(state, cardId) {
  const key = cardById[cardId].pre;
  return key ? PRECONDITIONS[key](state) : true;
}
// combat-card precondition from the battle form
const COMBAT_PRECONDITIONS = {
  nazLead1: (state, battle) => (battle.nazLead ?? 0) >= 1,
  nazLead2: (state, battle) => (battle.nazLead ?? 0) >= 2,
  nazInBattle: (state, battle) => (battle.nazLead ?? 0) > 0,
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
  if (card.deck === DECK.CALL_TO_BATTLE) {
    const factionKey = card.faction.toLowerCase();
    if (!state.board.factions[factionKey] || !battle.figures?.[factionKey])
      return false;
  }
  return card.cpre ? COMBAT_PRECONDITIONS[card.cpre](state, battle) : true;
}

// Every part of a new game, before the decks are built.
const defaultSettings = (settings) => ({
  dice: true,
  cards: true,
  tracker: true,
  wome: true,
  ...settings,
});
const newDice = () => ({
  pool: [],
  base: BASE_ACTION_DICE,
  hunt: 0,
  factionDie: false,
});
const newCards = () => ({
  decks: { [DECK.CHARACTER]: [], [DECK.STRATEGY]: [], [DECK.FACTION]: [] },
  discards: { [DECK.CHARACTER]: [], [DECK.STRATEGY]: [], [DECK.FACTION]: [] },
  hand: [],
  factionHand: [],
  table: [],
  factionTable: [],
});
const newFellowship = () => ({
  progress: 0,
  revealed: false,
  mordor: false,
  inFPSettlement: true,
  inStrongholdOrSea: true,
  atStart: true,
  guideGollum: false,
  companions: STARTING_COMPANIONS,
});
const newCharacters = () => ({
  saruman: false,
  witchKing: false,
  mouth: false,
  gandalfWhite: false,
  aragorn: false,
});
const newNations = () => ({
  ...SHADOW_NATION_START,
  gondor: FP_STANCE.PASSIVE,
  rohan: FP_STANCE.PASSIVE,
  north: FP_STANCE.PASSIVE,
  dwarves: FP_STANCE.PASSIVE,
  elves: FP_STANCE.ACTIVE,
});
const newFactions = () => ({
  corsairs: false,
  dunlendings: false,
  spiders: false,
  ents: false,
  eagles: false,
  deadmen: false,
});
const newBoard = () => ({
  fs: newFellowship(),
  chars: newCharacters(),
  nations: newNations(),
  factions: newFactions(),
  nazgul: 4,
  shadowVP: 0,
  corruption: 0,
  rings: 0,
});
function newState(settings) {
  const state = {
    appVersion: VERSION, // the version that last saved this game
    createdVersion: VERSION, // the version that created it
    settings: defaultSettings(settings),
    turn: 1,
    strategy: null,
    phase: PHASE.SETUP,
    dice: newDice(),
    cards: newCards(),
    board: newBoard(),
    ringUsedThisTurn: false,
    situational: {},
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
  if (card.deck === DECK.CALL_TO_BATTLE) return false;
  if (card.set === "WoME" && !wome) return false;
  if (card.id === "sa028b2" || card.id === "sa038b2") return !wome;
  if (card.id === "sa028" || card.id === "sa038") return wome;
  return true;
}
function buildDecks(state) {
  const wome = state.settings.wome;
  const decks = {
    [DECK.CHARACTER]: [],
    [DECK.STRATEGY]: [],
    [DECK.FACTION]: [],
  };
  for (const card of CARDS)
    if (inDecks(card, wome) && decks[card.deck]) decks[card.deck].push(card.id);
  state.cards.decks = Object.fromEntries(
    Object.entries(decks).map(([deckKey, ids]) => [deckKey, shuffle(ids)]),
  );
}

const SHADOW_FACES = [
  FACE.MUSTER,
  FACE.ARMY_MUSTER,
  FACE.ARMY,
  FACE.CHARACTER,
  FACE.EVENT,
  FACE.EYE,
];
const FACTION_FACES = [
  FACE.RECRUIT,
  FACE.PLAY_DRAW,
  FACE.RECRUIT_PLAY,
  FACE.RECRUIT_DRAW,
  FACE.EYE,
  FACE.WILD,
];
function diceCount(state) {
  const chars = state.board.chars;
  return (
    BASE_ACTION_DICE +
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
    state.dice.pool.push({
      kind: DIE_KIND.ACTION,
      face: null,
      status: DIE_STATE.POOL,
    });
  // WoME p.8: the Faction die joins the pool at the start of the turn after the first Shadow Faction enters play, and leaves it the turn after the last one is gone.
  state.dice.factionDie = shadowFactionInPlay(state);
  if (state.dice.factionDie)
    state.dice.pool.push({
      kind: DIE_KIND.FACTION,
      face: null,
      status: DIE_STATE.POOL,
    });
  state.minionReserved = false;
  state.ringUsedThisTurn = false;
  state.situational = {};
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
    (die) => die.kind === DIE_KIND.ACTION && die.status === DIE_STATE.POOL,
  );
  const cap = huntCap(state),
    placed = Math.min(requested, cap, pool.length);
  for (let i = 0; i < placed; i++) {
    pool[i].status = DIE_STATE.HUNT;
    pool[i].face = FACE.EYE;
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
          (state.board.fs.companions ?? 0) +
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
    if (die.status !== DIE_STATE.POOL) continue;
    die.face =
      die.kind === DIE_KIND.ACTION ? pick(SHADOW_FACES) : pick(FACTION_FACES);
    if (die.face === FACE.EYE) {
      die.status = DIE_STATE.HUNT;
      state.dice.hunt++;
      eyes++;
    } else die.status = DIE_STATE.AVAIL;
    out.push(die.face);
  }
  let hunt = "";
  if (eyes)
    hunt = " — " + eyes + " Eye" + (eyes > 1 ? "s" : "") + " to the Hunt box";
  log(state, "Rolled: " + out.join(", ") + hunt + ".");
  return out;
}
function preferredFaces(state) {
  return state.strategy === STRATEGY.CORRUPTION
    ? [FACE.CHARACTER]
    : [FACE.ARMY, FACE.MUSTER, FACE.ARMY_MUSTER];
}
// which available dice satisfy a requirement
const DIE_REQUIREMENT_FACES = {
  [DIE_REQUIREMENT.ARMY]: [FACE.ARMY, FACE.ARMY_MUSTER, FACE.WILD],
  [DIE_REQUIREMENT.MUSTER]: [FACE.MUSTER, FACE.ARMY_MUSTER, FACE.WILD],
  [DIE_REQUIREMENT.CHARACTER]: [FACE.CHARACTER, FACE.WILD],
  [DIE_REQUIREMENT.EVENT]: [FACE.EVENT, FACE.WILD],
  [DIE_REQUIREMENT.CHAR_OR_MUSTER]: [
    FACE.CHARACTER,
    FACE.MUSTER,
    FACE.ARMY_MUSTER,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_RECRUIT]: [
    FACE.RECRUIT,
    FACE.RECRUIT_PLAY,
    FACE.RECRUIT_DRAW,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_PLAY]: [
    FACE.PLAY_DRAW,
    FACE.RECRUIT_PLAY,
    FACE.WILD,
  ],
  [DIE_REQUIREMENT.FACTION_DRAW]: [
    FACE.PLAY_DRAW,
    FACE.RECRUIT_DRAW,
    FACE.WILD,
  ],
};
// Does a die already held for `have` satisfy a step that needs `need`?
function dieSatisfies(have, need) {
  return (
    !!have &&
    (have === need ||
      (need === DIE_REQUIREMENT.CHAR_OR_MUSTER &&
        (have === DIE_REQUIREMENT.CHARACTER ||
          have === DIE_REQUIREMENT.MUSTER)))
  );
}
function availableDice(state) {
  return state.dice.pool.filter((die) => die.status === DIE_STATE.AVAIL);
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
  die.status = DIE_STATE.USED;
  log(state, "Used the " + die.face + " die" + (why ? " — " + why : "") + ".");
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
// Elven Ring (rule 36): change one non-preferred available die to the required result.
function ringChange(state, req) {
  const available = availableDice(state).filter(
    (die) => die.kind === DIE_KIND.ACTION,
  );
  if (!available.length) return null;
  const die = nonPreferredFirst(state, available, 1)[0];
  const from = die.face;
  let face = req;
  if (req === DIE_REQUIREMENT.CHAR_OR_MUSTER) face = FACE.CHARACTER;
  else if (isFactionRequirement(req)) face = FACE.WILD;
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
  if (deckKey === DECK.FACTION) state.cards.factionHand.push(id);
  else state.cards.hand.push(id);
  log(
    state,
    "Drew a " +
      deckName(deckKey) +
      " card (" +
      (deckKey === DECK.FACTION
        ? state.cards.factionHand.length
        : state.cards.hand.length) +
      " in hand).",
  );
  return id;
}
function deckName(deckKey) {
  if (deckKey === DECK.CHARACTER) return "Character";
  return deckKey === DECK.STRATEGY ? "Strategy" : "Faction Event";
}
function handCounts(state) {
  return {
    character: handCardsOfDeck(state, DECK.CHARACTER).length,
    strategy: handCardsOfDeck(state, DECK.STRATEGY).length,
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
    (card.deck === DECK.FACTION
      ? state.cards.factionTable
      : state.cards.table
    ).push(id);
  } else if (card.deck !== DECK.CALL_TO_BATTLE)
    state.cards.discards[card.deck].push(id);
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
const FACTION_PICK = ["Preferred card", "Faction in play"]; // rule 3 breaks the tie
const FACTION_PICK_ITEMS = FACTION_PICK.concat("Otherwise at random (rule 3)");
// Servants of Sauron: draw three Faction Event cards, keep one by the priority list, shuffle the rest back with the discards.
function resolveServantsOfSauron(state) {
  const cards = state.cards;
  const deck = cards.decks[DECK.FACTION],
    discards = cards.discards[DECK.FACTION];
  if (deck.length < SERVANTS_DRAW && discards.length) {
    cards.decks[DECK.FACTION] = deck.concat(shuffle(discards));
    cards.discards[DECK.FACTION] = [];
  }
  const drawn = cards.decks[DECK.FACTION].splice(0, SERVANTS_DRAW);
  const picked = applyPriority(state, drawn, FACTION_PICK);
  if (picked.chosen) cards.factionHand.push(picked.chosen);
  const rest = drawn.filter((id) => id !== picked.chosen);
  cards.decks[DECK.FACTION] = shuffle(
    cards.decks[DECK.FACTION].concat(rest, cards.discards[DECK.FACTION]),
  );
  cards.discards[DECK.FACTION] = [];
  log(
    state,
    "Servants of Sauron: drew " +
      drawn.length +
      " Faction Event cards, kept one, reshuffled the rest and the discards into the deck.",
  );
  return [
    {
      kind: TRAIL.PRIORITY,
      text: "Servants of Sauron — keep one of " + drawn.length + " cards",
      items: FACTION_PICK_ITEMS,
      steps: picked.steps,
      card: picked.chosen,
    },
  ];
}
// His Will and His Malice: take a Faction Event card back from the discard pile, chosen by the priority list.
function resolveHisWillAndHisMalice(state, card) {
  const discards = state.cards.discards[DECK.FACTION];
  const picked = applyPriority(
    state,
    discards.filter((other) => other !== card.id),
    FACTION_PICK,
  );
  if (picked.chosen) {
    discards.splice(discards.indexOf(picked.chosen), 1);
    state.cards.factionHand.push(picked.chosen);
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
  return [
    {
      kind: TRAIL.PRIORITY,
      text: "His Will and His Malice — take a card from the Faction discard pile",
      items: FACTION_PICK_ITEMS,
      steps: picked.chosen ? picked.steps : ["Discard pile empty"],
      card: picked.chosen,
    },
  ];
}
// The Lidless Eye: turn up to three unused dice to Eyes and put them in the Hunt box (non-preferred results first, rule 23).
// Only when the app rolls the dice; otherwise the player moves the dice.
function resolveTheLidlessEye(state) {
  if (!state.settings.dice) return [];
  const chosen = nonPreferredFirst(
    state,
    availableDice(state).filter((die) => die.kind === DIE_KIND.ACTION),
    LIDLESS_EYE_DICE,
  );
  const from = chosen.map((die) => die.face);
  for (const die of chosen) {
    die.face = FACE.EYE;
    die.status = DIE_STATE.HUNT;
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
  return [{ kind: TRAIL.NOTE, text: "The Lidless Eye: " + noteText }];
}
// A Faction Event card that brings its faction into play: the tracker follows.
function resolveRecruitFaction(state, card) {
  const factionKey = card.faction.toLowerCase();
  if (state.board.factions[factionKey]) return [];
  state.board.factions[factionKey] = true;
  state.playable = {};
  log(
    state,
    card.faction +
      " are now in play (tracker updated; the Faction die joins the pool next turn).",
  );
  return [
    {
      kind: TRAIL.NOTE,
      text: card.faction + " enter play — tracker updated",
    },
  ];
}
// The effects the engine resolves itself when a card is played, by the card's `effect` flag; each returns trail entries.
const CARD_EFFECTS = {
  [CARD_EFFECT.SERVANTS]: resolveServantsOfSauron,
  [CARD_EFFECT.HIS_WILL]: resolveHisWillAndHisMalice,
  [CARD_EFFECT.LIDLESS_EYE]: resolveTheLidlessEye,
  [CARD_EFFECT.RECRUIT_FACTION]: resolveRecruitFaction,
};
// The Palantír of Orthanc: after an Event die plays an Event card, draw another card (a preferred one: Character under the corruption strategy, Strategy under military).
function resolvePalantirDraw(state, card, play) {
  if (
    play?.die !== DIE_REQUIREMENT.EVENT ||
    (card.deck !== DECK.CHARACTER && card.deck !== DECK.STRATEGY) ||
    !play.palantirBefore
  )
    return [];
  const deckKey =
    state.strategy === STRATEGY.CORRUPTION ? DECK.CHARACTER : DECK.STRATEGY;
  const got = drawCard(state, deckKey);
  log(
    state,
    "The Palantír of Orthanc: drew a " +
      deckName(deckKey) +
      " card after playing “" +
      card.title +
      "” with an Event die.",
  );
  return [
    {
      kind: TRAIL.NOTE,
      text:
        "The Palantír of Orthanc: drew a " +
        deckName(deckKey) +
        " card" +
        (got ? "" : " — deck empty"),
    },
  ];
}
// Card effects that change Queller's hand, dice or board and are not steps on a flowchart page (none for a combat card). Returns trail entries.
function resolveCardEffects(state, id, play) {
  if (play?.combat) return [];
  const card = cardById[id];
  const resolve = CARD_EFFECTS[card.effect];
  return (resolve ? resolve(state, card) : []).concat(
    resolvePalantirDraw(state, card, play),
  );
}
const FP_NATION_KEY = new RegExp("^nations\\.(" + FP_NATIONS.join("|") + ")$"); // a tracker change key for a Free Peoples nation
// Table cards whose discard condition the board tracker can see. `outcome(state, change)` returns {discard: reason} (discard now),
// {ask: question} (the player must decide) or null (nothing happens).
const sarumanEliminated = (change) =>
  change.key === "chars.saruman" && !change.to
    ? { discard: "Saruman eliminated" }
    : null;
const TABLE_TRIGGERS = [
  {
    id: CARD.WORMTONGUE,
    outcome: (state, change) => {
      if (
        change.key === "nations.rohan" &&
        change.from === FP_STANCE.PASSIVE &&
        change.to !== FP_STANCE.PASSIVE
      )
        return { discard: "Rohan activated" };
      return sarumanEliminated(change);
    },
  },
  {
    id: CARD.PALANTIR,
    outcome: (state, change) => sarumanEliminated(change),
  },
  {
    id: CARD.THREATS_AND_PROMISES,
    outcome: (state, change) => {
      if (!FP_NATION_KEY.test(change.key)) return null;
      if (FP_STANCE_RANK[change.to] <= FP_STANCE_RANK[change.from]) return null;
      if (change.from === FP_STANCE.PASSIVE)
        return {
          discard:
            "a Free Peoples nation advanced from passive (only an attack, a Companion or a Fellowship declaration can do that while the card is in play)",
        };
      return {
        ask: "Threats and Promises: did the nation go to war because of an attack or a Companion’s special ability (not a Muster die)?",
      };
    },
  },
  {
    id: CARD.FLOCKS_OF_CREBAIN,
    outcome: (state, change) =>
      fsDeclaredInFP(state, change)
        ? {
            ask: "Flocks of Crebain: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
          }
        : null,
  },
  {
    id: CARD.WORN_WITH_SORROW,
    outcome: (state, change) =>
      fsDeclaredInFP(state, change)
        ? {
            ask: "Worn with Sorrow and Toil: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
          }
        : null,
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
    const outcome = trigger.outcome(state, change);
    if (outcome?.discard) discardCard(state, trigger.id, outcome.discard);
    else if (outcome?.ask) asks.push({ card: trigger.id, q: outcome.ask });
  }
  return asks;
}
// Priority lists are applied as filters (rule 30): each criterion keeps the cards it accepts, a criterion that would keep
// nothing is skipped (rule 31), and a tie at the end is broken at random (rule 3).
const keepMatching = (ids, predicate) =>
  ids.filter((id) => predicate(cardById[id]));
// The best-ranked of the cards `only` selects; the cards it does not select are kept alongside the best.
function keepBestRanked(ids, { rank, max, only }) {
  const ranked = ids.filter((id) => !only || only(cardById[id]));
  let best = null;
  for (const id of ranked) {
    const value = rank(cardById[id]);
    if (best === null || (max ? value > best : value < best)) best = value;
  }
  return ids.filter(
    (id) => !ranked.includes(id) || rank(cardById[id]) === best,
  );
}
const applyCriterion = (ids, test) =>
  typeof test === "function"
    ? keepMatching(ids, test)
    : keepBestRanked(ids, test);
// One card from those still tied, at random (rule 3); the step says so when there was a tie.
function breakTie(ids, steps) {
  if (ids.length > 1) {
    steps.push(
      "Tie between " + ids.length + " cards — chosen at random (rule 3)",
    );
    return pick(ids);
  }
  return ids[0] || null;
}
function applyPriority(state, ids, criteria, play) {
  let remaining = ids.slice();
  const steps = [];
  const handLimits = {
    eventFull: state.cards.hand.length >= HAND_LIMIT[HAND.EVENT],
    factionFull: state.cards.factionHand.length >= HAND_LIMIT[HAND.FACTION],
  };
  for (const criterion of criteria) {
    if (remaining.length <= 1) break;
    const test = criterionTest(criterion, state, play, handLimits);
    if (!test) {
      steps.push(criterion + " → not a card criterion, skipped");
      continue;
    }
    const kept = applyCriterion(remaining, test);
    if (kept.length > 0 && kept.length < remaining.length) {
      steps.push(criterion + " → " + kept.length + " left");
      remaining = kept;
    } else if (kept.length === 0) steps.push(criterion + " → no card, skipped");
  }
  return { chosen: breakTie(remaining, steps), steps };
}
// A choice by successive rankings (a priority list that is not about cards): each [label, score] keeps the items with the
// highest score, a tie at the end is broken at random (rule 3). Returns {chosen, steps}.
function chooseByRank(items, rankings) {
  let remaining = items.slice();
  const steps = [];
  for (const [label, score] of rankings) {
    if (remaining.length <= 1) break;
    const best = Math.max(...remaining.map(score));
    remaining = remaining.filter((item) => score(item) === best);
    steps.push(label + " → " + remaining.join(", "));
  }
  let chosen = remaining[0] || null;
  if (remaining.length > 1) {
    chosen = pick(remaining);
    steps.push("tie — chosen at random (rule 3)");
  }
  return { chosen, steps };
}
const notCallToBattle = (card) => card.deck !== DECK.CALL_TO_BATTLE; // rule 19: Call to Battle cards ignore initiative
// The card criteria of the priority lists, matched in order (a longer phrase before the prefix it shares). Each entry builds a predicate
// on a card, or a rank spec {rank, max, only} that keepBestRanked resolves; flagsOf(card) is the card's flags for this game, handLimits the hand-limit facts.
const phraseIs = (phrase) => (text) => text === phrase,
  phraseStartsWith = (phrase) => (text) => text.startsWith(phrase);
const fullHand = (card, handLimits) =>
  card.deck === DECK.FACTION ? handLimits.factionFull : handLimits.eventFull;
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
  [phraseIs("strategy card"), () => (card) => card.deck === DECK.STRATEGY],
  [phraseIs("character card"), () => (card) => card.deck === DECK.CHARACTER],
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
      only: (card) => card.deck === DECK.CHARACTER,
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
  [phraseIs("preferred card"), (flagsOf) => (card) => flagsOf(card).preferred],
  [
    phraseIs("preferred event card"),
    (flagsOf) => (card) =>
      flagsOf(card).preferred && card.deck !== DECK.FACTION,
  ],
  [
    phraseIs("preferred faction event card"),
    (flagsOf) => (card) =>
      flagsOf(card).preferred && card.deck === DECK.FACTION,
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
    () => (card) => card.deck === DECK.CHARACTER || card.deck === DECK.STRATEGY,
  ],
  [phraseIs("faction event card"), () => (card) => card.deck === DECK.FACTION],
  [
    phraseStartsWith("strategy card which cancels"),
    () => (card) =>
      card.deck === DECK.STRATEGY && card.combatTitle === "Swarm of Bats",
  ],
  [
    phraseIs("durin's bane"),
    () => (card) => card.combatTitle === "Durin's Bane",
  ],
  [
    phraseIs("call to battle card"),
    () => (card) => card.deck === DECK.CALL_TO_BATTLE,
  ],
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
// Discard one hand (HAND.EVENT or HAND.FACTION) down to its limit using a priority list (discard = the card that best fits).
function autoDiscard(state, criteria, hand) {
  const limit = HAND_LIMIT[hand];
  const cards =
    hand === HAND.FACTION ? state.cards.factionHand : state.cards.hand;
  const done = [];
  let guard = 0;
  while (cards.length > limit && guard++ < DISCARD_GUARD) {
    const picked = applyPriority(state, cards.slice(), criteria);
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
  state.log.push({ text, turn: state.turn, ...extra });
  if (state.log.length > LOG_CAP) state.log.shift();
}

export {
  VERSION,
  STRATEGY,
  PHASE,
  DECK,
  HAND,
  HAND_LIMIT,
  DIE_KIND,
  DIE_STATE,
  FACE,
  DIE_REQUIREMENT,
  isFactionRequirement,
  FP_STANCE,
  FP_STANCE_RANK,
  SHADOW_NATIONS,
  FP_NATIONS,
  SHADOW_FACTIONS,
  CARD,
  CARD_EFFECT,
  TRAIL,
  BASE_ACTION_DICE,
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
  chooseByRank,
  criterionTest,
  autoDiscard,
  CARD_EFFECTS,
  resolveCardEffects,
  tableTriggers,
  log,
};
