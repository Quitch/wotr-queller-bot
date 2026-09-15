// The engine's public surface: game state, dice, cards, playability and priorities (window.QB together with the walker).
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
  MINIONS,
  MINION_STATUS,
  CARD,
  CARD_EFFECT,
  TRAIL,
  BASE_ACTION_DICE,
} from "./constants.js";
export {
  SHADOW_NATION_START,
  shadowNationAtWar,
  allShadowNationsAtWar,
  politicalTrackLabel,
  fpNationAtWar,
  allFPNationsAtWar,
  minionInPlay,
  shadowFactionInPlay,
  allShadowFactionsInPlay,
  ringsKnown,
  ringAvailable,
  huntCap,
  minionsAvailable,
} from "./board.js";
export { migrate, newState, buildDecks } from "./state.js";
export { CARDS } from "../cards/index.js";
export {
  cardById,
  cardFlags,
  FACTION_CAT,
  MUSTER_CHOICE,
  staysOnTable,
  handCardsOfDeck,
  combatCandidates,
  callToBattleCards,
} from "./cards.js";
export { randomBelow, pick, shuffle } from "./random.js";
export {
  SITUATIONAL_QUESTIONS,
  precondition,
  combatPrecondition,
} from "./preconditions.js";
export {
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
} from "./dice.js";
export {
  drawCard,
  deckName,
  handCounts,
  discardCard,
  playCard,
} from "./hand.js";
export {
  applyPriority,
  chooseByRank,
  criterionTest,
  autoDiscard,
} from "./priority.js";
export { CARD_EFFECTS, resolveCardEffects } from "./effects.js";
export { tableTriggers } from "./triggers.js";
export { log } from "./log.js";
