// Priority lists: card criteria applied as filters, a choice by successive rankings, and discarding down to a hand limit.
import { FACTION_CAT, cardById, cardFlags } from "./cards.js";
import { DECK, DISCARD_GUARD, HAND, HAND_LIMIT } from "./constants.js";
import { discardCard } from "./hand.js";
import { pick } from "./random.js";

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
export function applyPriority(state, ids, criteria, play) {
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
export function chooseByRank(items, rankings) {
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
export function criterionTest(crit, state, play, handLimits) {
  const flagsOf = (card) => cardFlags(card, state);
  const phrase = crit.replaceAll("*", "").toLowerCase();
  const entry = CRITERIA.find(([matches]) => matches(phrase));
  return entry ? entry[1](flagsOf, handLimits) : null;
}
// Discard one hand (HAND.EVENT or HAND.FACTION) down to its limit using a priority list (discard = the card that best fits).
export function autoDiscard(state, criteria, hand) {
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
