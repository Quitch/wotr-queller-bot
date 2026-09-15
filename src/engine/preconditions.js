// Card preconditions: the board facts a card's event half needs (`pre`) and the battle facts its combat half needs
// (`cpre`); a situational question is asked of the player once per turn.
import {
  allShadowNationsAtWar,
  minionInPlay,
  shadowNationAtWar,
} from "./board.js";
import { cardById } from "./cards.js";
import { DECK, DIE_KIND } from "./constants.js";
import { availableDice } from "./dice.js";

// Each returns true/false, or asks a situational question (answered once per turn) via situationalAnswer().
export const SITUATIONAL_QUESTIONS = {
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
  saruman: (state) => minionInPlay(state, "saruman"),
  witchKing: (state) => minionInPlay(state, "witchKing"),
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
    minionInPlay(state, "witchKing")
      ? situationalAnswer(state, "wkBesieging")
      : false,
  isenBesieging: (state) =>
    minionInPlay(state, "saruman")
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
export function precondition(state, cardId) {
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
export function combatPrecondition(state, card) {
  const battle = state.battle || {};
  if (card.deck === DECK.CALL_TO_BATTLE) {
    const factionKey = card.faction.toLowerCase();
    if (!state.board.factions[factionKey] || !battle.figures?.[factionKey])
      return false;
  }
  return card.cpre ? COMBAT_PRECONDITIONS[card.cpre](state, battle) : true;
}
