// The app version, the enums and the limits the engine and the rest of the app share.

export const VERSION = 61; // app version (shown in the debug log and stamped on saves)
// The flowchart revision a walk was made on: 1 was the released flowchart, 2 the Draft of 2026-10-15, 3 the same with
// the Elven Ring results of rule 46 (walk.ringDice replaces walk.ringArmed). Every node id of revision 1 is still there, so
// an unfinished walk from an older revision resumes on the new graph (migrate).
export const FLOW_REV = 3;
// Revision 1's steps that became priority lists, and the step drawn after each that now carries what they asked: a
// walk paused at one moves there with its open prompt.
export const FLOW_REV_1_MOVED_STEPS = {
  "C14.disc14": "discOne14",
  "C14.disc18": "discOne18",
  "C14.discF": "discOneF",
  "M14.disc": "discOne",
  "M14.discF": "discOneF",
  "BA.casualties": "removeCas",
};

// The values are what saved games and the card data (cards/) hold, so they must not change without a migrate() step.
export const STRATEGY = { CORRUPTION: "corruption", MILITARY: "military" };
export const PHASE = {
  SETUP: "setup",
  P1: "p1",
  P2: "p2",
  P3: "p3",
  P4: "p4",
  P5: "p5",
  P6: "p6",
};
// A phase as the header shows it; "Phase 1" to "Phase 5" are also the flowchart start points a walk can end at.
export const PHASE_LABEL = {
  [PHASE.SETUP]: "Setup",
  [PHASE.P1]: "Phase 1",
  [PHASE.P2]: "Phase 2",
  [PHASE.P3]: "Phase 3",
  [PHASE.P4]: "Phase 4",
  [PHASE.P5]: "Phase 5",
  [PHASE.P6]: "Phase 6",
};
// Card decks (the `deck` field of a card and the keys of cards.decks / cards.discards).
export const DECK = {
  CHARACTER: "C",
  STRATEGY: "S",
  FACTION: "F",
  CALL_TO_BATTLE: "B",
};
// Queller's two hands: the Event hand (Character and Strategy cards) and the Faction Event hand.
export const HAND = { EVENT: "E", FACTION: "F" };
export const HAND_LIMIT = { [HAND.EVENT]: 6, [HAND.FACTION]: 4 };
export const DIE_KIND = { ACTION: "A", FACTION: "F" };
export const DIE_STATE = {
  POOL: "pool",
  HUNT: "hunt",
  AVAIL: "avail",
  USED: "used",
  RESERVED: "reserved",
};
export const FACE = {
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
export const DIE_REQUIREMENT = {
  ARMY: "Army",
  MUSTER: "Muster",
  CHARACTER: "Character",
  EVENT: "Event",
  CHAR_OR_MUSTER: "CharOrMuster",
  FACTION_RECRUIT: "FRecruit",
  FACTION_PLAY: "FPlay",
  FACTION_DRAW: "FDraw",
};
const FACTION_REQUIREMENTS = new Set([
  DIE_REQUIREMENT.FACTION_RECRUIT,
  DIE_REQUIREMENT.FACTION_PLAY,
  DIE_REQUIREMENT.FACTION_DRAW,
]);
export const isFactionRequirement = (req) => FACTION_REQUIREMENTS.has(req);
// Free Peoples nations on the Political Track.
export const FP_STANCE = { PASSIVE: "passive", ACTIVE: "active", WAR: "war" };
export const FP_STANCE_RANK = {
  [FP_STANCE.PASSIVE]: 0,
  [FP_STANCE.ACTIVE]: 1,
  [FP_STANCE.WAR]: 2,
};
export const SHADOW_NATIONS = ["sauron", "isengard", "se"];
export const FP_NATIONS = ["gondor", "rohan", "north", "dwarves", "elves"];
// The minions Queller can muster (tracker fields under board.chars) and where each one is: an eliminated Character never returns.
export const MINIONS = ["saruman", "witchKing", "mouth"];
export const MINION_STATUS = {
  AVAILABLE: "available",
  IN_PLAY: "inPlay",
  ELIMINATED: "eliminated",
};
export const SHADOW_FACTIONS = ["corsairs", "dunlendings", "spiders"];
// Cards the engine or the UI single out by id.
export const CARD = {
  PALANTIR: "sa045",
  BALROG: "sa001b2",
  WORMTONGUE: "sa051",
  THREATS_AND_PROMISES: "sa050",
  FLOCKS_OF_CREBAIN: "sa009",
  WORN_WITH_SORROW: "sa052",
  BLACK_SAILS: "sa_Faction03",
};
// The `effect` flag of a card: an effect the engine resolves itself when the card is played.
export const CARD_EFFECT = {
  SERVANTS: "servants",
  HIS_WILL: "hisWill",
  LIDLESS_EYE: "lidlessEye",
  RECRUIT_FACTION: "recruitFaction",
};
// The kinds of entry in a walk's trail (the walker writes most of them; the engine adds entries for card effects).
export const TRAIL = {
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
export const BASE_ACTION_DICE = 7; // the Shadow's dice before any minion joins
export const STARTING_COMPANIONS = 7;
export const LOG_CAP = 400; // log entries kept in the game state
export const SERVANTS_DRAW = 3; // Faction Event cards Servants of Sauron looks at
export const LIDLESS_EYE_DICE = 3; // dice The Lidless Eye turns to Eyes
export const DISCARD_GUARD = 10; // at most this many discards in one hand-limit check
