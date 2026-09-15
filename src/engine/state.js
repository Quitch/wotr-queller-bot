// A new game (every part of the state, then the decks) and the migration of older saves.
import { CARDS } from "../cards/index.js";
import { SHADOW_NATION_START } from "./board.js";
import {
  BASE_ACTION_DICE,
  DECK,
  FP_STANCE,
  PHASE,
  SHADOW_NATIONS,
  STARTING_COMPANIONS,
  VERSION,
} from "./constants.js";
import { shuffle } from "./random.js";

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
export function newState(settings) {
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
export function buildDecks(state) {
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
// Older saves kept the Shadow nations as booleans (true = at war); now they are steps above At War.
function migrateNations(nations) {
  for (const nation of SHADOW_NATIONS) {
    if (typeof nations[nation] === "boolean")
      nations[nation] = nations[nation] ? 0 : SHADOW_NATION_START[nation];
    else if (typeof nations[nation] !== "number")
      nations[nation] = SHADOW_NATION_START[nation];
  }
}
export function migrate(save) {
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
