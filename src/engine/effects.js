// The card effects the engine resolves itself when a card is played (by the card's `effect` flag) and the Palantír draw.
import { cardById } from "./cards.js";
import {
  CARD_EFFECT,
  DECK,
  DIE_KIND,
  DIE_REQUIREMENT,
  DIE_STATE,
  FACE,
  LIDLESS_EYE_DICE,
  SERVANTS_DRAW,
  STRATEGY,
  TRAIL,
} from "./constants.js";
import { availableDice, nonPreferredFirst } from "./dice.js";
import { deckName, drawCard } from "./hand.js";
import { log } from "./log.js";
import { applyPriority } from "./priority.js";
import { shuffle } from "./random.js";

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
export const CARD_EFFECTS = {
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
export function resolveCardEffects(state, id, play) {
  if (play?.combat) return [];
  const card = cardById[id];
  const resolve = CARD_EFFECTS[card.effect];
  return (resolve ? resolve(state, card) : []).concat(
    resolvePalantirDraw(state, card, play),
  );
}
