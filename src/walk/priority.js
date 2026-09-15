// The purple boxes: card picks by the priority lists, and the faction, nation and minion choices.
import * as engine from "../engine/index.js";
import { HAND, TRAIL, cardById } from "../engine/index.js";
import { FLOW, NODE } from "../flow/index.js";
import { follow, setPrompt, trail } from "./core.js";
import { SHADOW_NATION_NAME } from "./nations.js";
import { evalPlayable } from "./playable.js";
import { FALL_THROUGH, PENDING, PROMPT } from "./prompt.js";

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
// Record a priority list the app resolved (steps: how; card or choice: the result) and move on.
function recordPriority(state, node, details) {
  trail(state, {
    kind: TRAIL.PRIORITY,
    text: NODE.text(node),
    items: NODE.extra(node).items,
    ...details,
    auto: true,
  });
  follow(state, null);
}
function promptChoice(state, node, text, options, set) {
  setPrompt(state, {
    type: PROMPT.CHOICE,
    text,
    items: NODE.extra(node).items,
    options,
    set,
    node: state.walk.node,
    page: state.walk.page,
    pri: NODE.text(node),
  });
}
const priorityFacts = (state) => ({
  walk: state.walk,
  cardsOn: state.settings.cards,
  trackerOn: state.settings.tracker,
  wome: state.settings.wome,
});
// The cards a decision left as candidates, filtered by the box's priority list.
function chooseCardByPriority(state, node, { walk, cardsOn }) {
  if (!cardsOn) return FALL_THROUGH;
  return chooseAmong(state, node, walk, (walk.cands || []).slice());
}
function chooseAmong(state, node, walk, candidates) {
  if (!candidates.length) {
    walk.chosen = null;
    return continuePriority(state, node, "no candidate card");
  }
  const picked = engine.applyPriority(
    state,
    candidates,
    NODE.extra(node).items,
  );
  walk.chosen = picked.chosen;
  walk.steps = picked.steps;
  recordPriority(state, node, { steps: picked.steps, card: picked.chosen });
}
// Every card Queller could use as a combat card, plus the Call to Battle cards it can use; PENDING while a card check is open.
function gatherCombatCandidates(state, walk) {
  const playable = evalPlayable(
    state,
    engine.combatCandidates(state),
    "combat",
  );
  if (playable === PENDING) return PENDING;
  walk.cands = playable;
  if (!state.settings.wome) {
    walk.ctb = [];
    return;
  }
  const callToBattle = evalPlayable(
    state,
    engine.callToBattleCards(state),
    "combat",
  );
  if (callToBattle === PENDING) return PENDING;
  walk.ctb = callToBattle;
}
// A combat-card priority list; the attacker's list also considers Call to Battle cards.
const chooseCombatCardByPriority = (withCallToBattle) =>
  function chooseCombatCard(state, node, { walk, cardsOn }) {
    if (!cardsOn) return FALL_THROUGH;
    if (gatherCombatCandidates(state, walk) === PENDING) return PENDING;
    let candidates = (walk.cands || []).slice();
    if (withCallToBattle) candidates = candidates.concat(walk.ctb || []);
    return chooseAmong(state, node, walk, candidates);
  };
const nodeByKey = (key) => {
  const [page, id] = key.split(".");
  return FLOW[page].nodes[id];
};
// "Discard priority": discard each listed hand down to its limit by a priority list (the box's own, or another box's).
// On the Event page the Faction hand is only checked with WoME in play.
const discardByPriority = (hands) =>
  function discardCards(state, node, { walk, cardsOn, wome }) {
    if (!cardsOn) return FALL_THROUGH;
    const discarded = [];
    for (const [hand, listKey] of hands) {
      if (hand === HAND.FACTION && listKey && !wome) continue;
      const items = NODE.extra(listKey ? nodeByKey(listKey) : node).items;
      discarded.push(...engine.autoDiscard(state, items, hand));
    }
    walk.discards = discarded;
    recordPriority(state, node, {
      steps: discarded.length
        ? discarded.map((id) => "Discarded “" + cardById[id].title + "”")
        : ["Nothing to discard"],
    });
  };
const SHADOW_FACTION_NAMES = ["Corsairs", "Dunlendings", "Spiders"];
const factionsNotInPlay = (state) =>
  SHADOW_FACTION_NAMES.filter(
    (name) => !state.board.factions[name.toLowerCase()],
  );
// How many Faction Event cards of each faction Queller holds or has in play, and how many of those are preferred.
function factionCardCounts(state) {
  const counts = {};
  for (const id of state.cards.factionHand.concat(state.cards.factionTable)) {
    const card = cardById[id];
    if (!card.faction) continue;
    counts[card.faction] = counts[card.faction] || { preferred: 0, total: 0 };
    counts[card.faction].total++;
    if (engine.cardFlags(card, state).preferred)
      counts[card.faction].preferred++;
  }
  return counts;
}
// "Recruit priority" with cards on: the faction with the most preferred cards, then the most cards, then at random.
function chooseFactionFromCards(state, node, walk) {
  const counts = factionCardCounts(state);
  const preferredOf = (name) => (counts[name] || { preferred: 0 }).preferred,
    totalOf = (name) => (counts[name] || { total: 0 }).total;
  const { chosen, steps } = engine.chooseByRank(factionsNotInPlay(state), [
    ["most *preferred* Faction Event cards", preferredOf],
    ["most Faction Event cards", totalOf],
  ]);
  walk.factionChoice = chosen;
  if (!chosen) steps.push("all factions already in play");
  recordPriority(state, node, {
    steps,
    choice: walk.factionChoice || "none",
  });
}
// Without cards the tracker still knows which factions are left; the player picks among them.
function chooseFactionFromTracker(state, node, walk) {
  const notInPlay = factionsNotInPlay(state);
  if (notInPlay.length > 1) return askFactionChoice(state, node, notInPlay);
  walk.factionChoice = notInPlay[0] || null;
  recordPriority(state, node, {
    steps: [
      notInPlay.length
        ? "Only the " + notInPlay[0] + " are not yet in play"
        : "all factions already in play",
    ],
    choice: walk.factionChoice || "none",
  });
}
function askFactionChoice(state, node, notInPlay) {
  promptChoice(
    state,
    node,
    "Recruit priority: which faction has the most Faction Event cards in Queller’s hand and in play (preferred cards first)?",
    notInPlay.map((name) => ({ value: name, label: name })),
    "factionChoice",
  );
}
function chooseFactionToRecruit(state, node, { walk, cardsOn, trackerOn }) {
  if (cardsOn) return chooseFactionFromCards(state, node, walk);
  if (trackerOn) return chooseFactionFromTracker(state, node, walk);
  return FALL_THROUGH;
}
// "Political Track priority" without the tracker: the player says which nation (or a faction) comes first.
function askNationChoice(state, node, { cardsOn, wome }) {
  const factionsKnown = cardsOn && wome;
  const options = [{ value: "Isengard", label: "Isengard (not yet At War)" }];
  if (wome && !(factionsKnown && engine.allShadowFactionsInPlay(state)))
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
  promptChoice(
    state,
    node,
    "Political Track priority: which is the first of these that applies?",
    options,
    "nationChoice",
  );
}
// "Political Track priority" from the tracker: the first eligible entry in the list's order.
function chooseNationToAdvance(state, node, facts) {
  if (!facts.trackerOn) return askNationChoice(state, node, facts);
  const { walk, wome } = facts;
  const nations = state.board.nations;
  const eligible = [];
  if (!engine.shadowNationAtWar(state, "isengard")) eligible.push("Isengard");
  if (wome && !engine.allShadowFactionsInPlay(state)) eligible.push("Faction");
  if (!engine.shadowNationAtWar(state, "sauron")) eligible.push("Sauron");
  if (!engine.shadowNationAtWar(state, "se"))
    eligible.push("Southrons and Easterlings");
  walk.nationChoice = eligible[0] || null;
  const trackPositions = engine.SHADOW_NATIONS.map(
    (nationKey) =>
      SHADOW_NATION_NAME[nationKey] +
      ": " +
      engine.politicalTrackLabel(nations[nationKey] ?? 0),
  ).join(", ");
  recordPriority(state, node, {
    steps: [
      "Political Track — " + trackPositions,
      eligible.length
        ? "Eligible: " + eligible.join(", ")
        : "Every Shadow nation is at war",
    ],
    choice: walk.nationChoice || "none",
  });
}
// "Minion priority" without the tracker: the player says which minion can be mustered (with dice on, the app knows
// which minions are in play or eliminated, and offers only the available ones).
function askMinionChoice(state, node) {
  const chars = state.board.chars,
    minionsKnown = state.settings.dice;
  const offered = (key) =>
    !minionsKnown || chars[key] === engine.MINION_STATUS.AVAILABLE;
  const options = [];
  if (offered("saruman"))
    options.push({ value: "Saruman", label: "Saruman (Isengard At War)" });
  if (offered("witchKing"))
    options.push({
      value: "Witch King",
      label: "Witch King (Sauron At War and a Free Peoples nation At War)",
    });
  if (offered("mouth"))
    options.push({
      value: "Mouth of Sauron",
      label:
        "Mouth of Sauron (all Free Peoples nations At War, or the Fellowship on the Mordor track)",
    });
  options.push({ value: "", label: "None can be mustered" });
  promptChoice(
    state,
    node,
    "Minion priority: which is the first of these that can be mustered (available: not in play and not eliminated)?",
    options,
    "minionPick",
  );
}
function chooseMinionToMuster(state, node, { walk, trackerOn }) {
  if (!trackerOn) return askMinionChoice(state, node);
  const minions = engine.minionsAvailable(state);
  walk.minionPick = minions.length ? minions[0].name : null;
  recordPriority(state, node, {
    steps: minions.length
      ? ["Eligible: " + minions.map((minion) => minion.name).join(", ")]
      : ["No minion can be mustered"],
    choice: walk.minionPick || "none",
  });
}
// The priority-list boxes the app resolves itself, keyed by page and node id. A handler is (state, node, facts) and returns
// FALL_THROUGH to show the list to the player instead.
const PRIORITY_HANDLERS = {
  "EV.prefPri": chooseCardByPriority,
  "EV.anyPri": chooseCardByPriority,
  "FA.playPri": chooseCardByPriority,
  "BA.sortiePri": chooseCardByPriority,
  "BA.wkPri": chooseCombatCardByPriority(false),
  "BA.atkPri": chooseCombatCardByPriority(true),
  "BA.defPri": chooseCombatCardByPriority(false),
  "EV.discPri": discardByPriority([
    [HAND.EVENT, null],
    [HAND.FACTION, "FA.discPri"],
  ]),
  "FA.discPri": discardByPriority([[HAND.FACTION, null]]),
  "FA.recruitPri": chooseFactionToRecruit,
  "MU.nationPri": chooseNationToAdvance,
  "MU.minionPri": chooseMinionToMuster,
};
function promptPriorityList(state, node) {
  setPrompt(state, {
    type: PROMPT.PRIORITY,
    text: NODE.text(node),
    items: NODE.extra(node).items,
    node: state.walk.node,
  });
}
export function handlePriority(state, node) {
  const walk = state.walk;
  const handler = PRIORITY_HANDLERS[walk.page + "." + walk.node];
  if (handler) {
    const result = handler(state, node, priorityFacts(state));
    if (result !== FALL_THROUGH) return result;
  }
  promptPriorityList(state, node);
}
