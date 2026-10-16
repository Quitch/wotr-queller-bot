// A new game (every part of the state, then the decks) and the migration of older saves.
import { CARDS } from "../cards/index.js";
import { SHADOW_NATION_START } from "./board.js";
import {
  BASE_ACTION_DICE,
  DECK,
  DIE_REQUIREMENT,
  FP_STANCE,
  MINIONS,
  MINION_STATUS,
  PHASE,
  SHADOW_NATIONS,
  STARTING_COMPANIONS,
  TRAIL,
  VERSION,
  FLOW_REV,
  FLOW_REV_1_MOVED_STEPS,
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
  saruman: MINION_STATUS.AVAILABLE,
  witchKing: MINION_STATUS.AVAILABLE,
  mouth: MINION_STATUS.AVAILABLE,
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
    messengerUsedThisTurn: false, // Messenger of the Dark Tower (rule 30): once per turn
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
// The base cards WoME removes (its setup: Shelob's Lair, Corsairs of Umbar, Rage of the Dunlendings), replaced by its
// three Shadow Event cards.
const REPLACED_BY_WOME = new Set(["sa034", "sa028b2", "sa038b2"]);
// The WoME-rev cards (revised Corsairs and Rage) are in no deck: the WoME setup replaces the base cards with the WoME
// Shadow Event cards, and these revisions are not among them. Their data stays so that an older WoME game holding one
// in hand or on the table still shows it.
const neverDealt = (card) => card.set === "WoME-rev";
// Whether a card goes into this game's decks: Call to Battle cards never do, WoME cards only with the expansion.
function inDecks(card, wome) {
  if (card.deck === DECK.CALL_TO_BATTLE || neverDealt(card)) return false;
  if (card.set === "WoME") return wome;
  return !(wome && REPLACED_BY_WOME.has(card.id));
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
// Older saves (up to version 60) kept each minion as a boolean (true = in play); now the field is a MINION_STATUS.
function migrateMinions(chars) {
  const statuses = new Set(Object.values(MINION_STATUS));
  for (const key of MINIONS) {
    if (typeof chars[key] === "boolean")
      chars[key] = chars[key] ? MINION_STATUS.IN_PLAY : MINION_STATUS.AVAILABLE;
    else if (!statuses.has(chars[key])) chars[key] = MINION_STATUS.AVAILABLE;
  }
}
// A WoME game built before its decks followed the WoME setup dealt Shelob's Lair and the WoME-rev Corsairs and Rage:
// they leave the Character and Strategy draw decks. Their discards are never reshuffled (rule 25), so a copy that was
// drawn, and later played or discarded, stays where it is.
function migrateWomeDecks(decks) {
  const removed = new Set(
    CARDS.filter(
      (card) => neverDealt(card) || REPLACED_BY_WOME.has(card.id),
    ).map((card) => card.id),
  );
  for (const deckKey of [DECK.CHARACTER, DECK.STRATEGY])
    if (Array.isArray(decks[deckKey]))
      decks[deckKey] = decks[deckKey].filter((id) => !removed.has(id));
}
// An unfinished walk from the released flowchart resumes on the new graph, so nothing it already did is done twice.
function migrateWalk(walk) {
  const from = walk.flowRev || 1;
  if (from < 2) migrateWalkFromRev1(walk);
  if (from < 3) migrateWalkFromRev2(walk);
  walk.flowRev = FLOW_REV;
}
// Fields a walk gained after version 61 (walkDieState in walk/core.js): a walk saved without them resumes with their
// defaults, whatever its flowchart revision.
function migrateWalkFields(walk) {
  walk.armyMoves ??= 0;
  walk.messengerAns ??= null;
  walk.dieViaMessenger ??= false;
  for (const frame of walk.stack || []) frame.dieViaMessenger ??= false;
  if (walk.armyStart === undefined) walk.armyStart = savedArmyStart(walk);
  migrateArmyMovePrompt(walk);
}
// A prompt saved at an Army-page move before the second move existed has no armyMove flags: give it the ones
// armyMoveFlags in walk/actions.js gives ("action" is PROMPT.ACTION in walk/prompt.js).
function migrateArmyMovePrompt(walk) {
  const prompt = walk.prompt;
  if (walk.page !== "AR" || walk.die !== DIE_REQUIREMENT.ARMY) return;
  if (walk.armyMoves || prompt?.type !== "action") return;
  if (prompt.text === "Move/Attack")
    Object.assign(prompt, { armyMove: true, moveOrAttack: true });
  else if (prompt.text.startsWith("Move")) prompt.armyMove = true;
}
// The start point a walk on (or returning to) the Army page entered it at: the last Army jump in its trail, else the
// walk's own start. The pattern matches the trail text of the Army boxes of JUMPS in walk/jumps-table.js.
const ARMY_JUMP = /^(Army(?: [2-4])?)(?: \(|$)/;
function savedArmyStart(walk) {
  const stack = walk.stack || [];
  if (walk.page !== "AR" && !stack.some((frame) => frame.page === "AR"))
    return null;
  const jump = (walk.trail || []).findLast(
    (entry) => entry.kind === TRAIL.JUMP && ARMY_JUMP.test(entry.text),
  );
  if (jump) return ARMY_JUMP.exec(jump.text)[1];
  return walk.entry?.page === "AR" ? walk.entry.start : null;
}
// Revision 2 armed a ring for whatever die the next step needed (ringArmed); revision 3 keeps the dice rule 46 allows
// ("any" is that same reading) and a ring use waiting for its die to be spent.
function migrateWalkFromRev2(walk) {
  walk.ringDice = walk.ringArmed ? "any" : null;
  delete walk.ringArmed;
  walk.ringNeeds = null;
  walk.ringAsk = null;
  walk.ringAnswer = null;
  walk.ringDeclined = null;
  walk.ringPending = null;
}
function migrateWalkFromRev1(walk) {
  walk.attacking ??= null;
  const moved = FLOW_REV_1_MOVED_STEPS[walk.page + "." + walk.node];
  if (moved) {
    walk.node = moved;
    if (walk.prompt) walk.prompt.node = moved;
  }
  // the released flowchart returned to "Use Muster die set aside for minion" and stopped there; the new graph goes on
  // to "Discard unplayable die", so without that frame doReturn spends the die instead (rule 34)
  walk.stack = (walk.stack || []).filter((frame) => frame.node !== "minionDie");
  if (walk.minionPick === "Witch King") walk.minionPick = "Witch-king";
  const prompt = walk.prompt;
  if (!prompt) return;
  if (prompt.any) prompt.conditions = true;
  for (const option of prompt.options || [])
    if (option.value === "Witch King") option.value = "Witch-king";
}
export function migrate(save) {
  if (save.settings && save.settings.tracker === undefined) {
    save.settings.tracker = save.settings.walk !== false;
    delete save.settings.walk;
  }
  if (save.board?.nations) migrateNations(save.board.nations);
  if (save.board?.chars) migrateMinions(save.board.chars);
  if (save.board && save.board.rings === undefined) save.board.rings = 0;
  if (save.settings?.wome && save.cards?.decks)
    migrateWomeDecks(save.cards.decks);
  if (save.walk && !save.walk.done) {
    if ((save.walk.flowRev || 1) < FLOW_REV) migrateWalk(save.walk);
    migrateWalkFields(save.walk);
  }
  delete save.shownCard;
  delete save.lastAction;
  return save;
}
