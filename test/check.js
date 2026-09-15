// Static consistency checks between the walker / the engine and the flowchart + card data. Exit 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import * as fakeWindow from "./load.js";
const FLOW = fakeWindow.QB_FLOW,
  NODE = fakeWindow.QB_NODE,
  NODE_KIND = fakeWindow.QB_NODE_KIND,
  EDGE = fakeWindow.QB_EDGE,
  engine = fakeWindow.QB;
let fails = 0;
const fail = (message) => {
  fails++;
  console.log("FAIL", message);
};
// A "PAGE.node" string literal, as the walker's handler tables and jump specs use them.
const NODE_KEY = /"([A-Z0-9]+)\.([A-Za-z0-9]+)"/g;
const WALK_DIR = path.join(import.meta.dirname, "..", "src", "walk");
const MIN_NODE_KEYS = 129; // the keys the walker held when this check was written; a split that lost a file would show here
// Every "PAGE.node" key in the walker's modules names a real node. Returns how many keys were checked, so a regex that
// stops matching (or a module the scan no longer reaches) is visible.
function checkNodeKeysExist() {
  const keys = new Set();
  for (const file of fs.readdirSync(WALK_DIR, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    const source = fs.readFileSync(path.join(WALK_DIR, file), "utf8");
    for (const [, pageKey, nodeId] of source.matchAll(NODE_KEY)) {
      if (!FLOW[pageKey]) continue;
      keys.add(pageKey + "." + nodeId);
      if (!FLOW[pageKey].nodes[nodeId])
        fail(file + " refers to missing node " + pageKey + "." + nodeId);
    }
  }
  if (keys.size < MIN_NODE_KEYS)
    fail("only " + keys.size + " node keys found under src/walk/");
  return keys.size;
}
// Every criterion on a card priority list is understood by criterionTest.
function checkCardCriteriaResolve(state) {
  for (const nodeKey of engine.CARD_CRITERIA_NODES) {
    const [pageKey, nodeId] = nodeKey.split(".");
    const node = FLOW[pageKey]?.nodes[nodeId];
    if (!node) {
      fail("card list " + nodeKey + " missing");
      continue;
    }
    for (const criterion of NODE.extra(node).items)
      if (
        !engine.criterionTest(criterion, state, null, {
          eventFull: false,
          factionFull: false,
        })
      )
        fail(nodeKey + ': criterionTest cannot resolve "' + criterion + '"');
  }
}
// Every grey box has a JUMPS entry; every decision has two arrows; every non-action box has a way out.
function checkFlowchartShape() {
  for (const pageKey in FLOW)
    for (const nodeId in FLOW[pageKey].nodes) {
      const node = FLOW[pageKey].nodes[nodeId];
      const kind = NODE.kind(node);
      const outEdges = FLOW[pageKey].edges.filter(
        (edge) => EDGE.from(edge) === nodeId,
      );
      if (kind === NODE_KIND.JUMP && !engine.jumpSpec(NODE.text(node)))
        fail(
          "no JUMPS entry for " +
            pageKey +
            "." +
            nodeId +
            ' "' +
            engine.normalizeText(NODE.text(node)) +
            '"',
        );
      if (
        (kind === NODE_KIND.DECISION || kind === NODE_KIND.FOLLOW_UP) &&
        outEdges.length !== 2
      )
        fail(pageKey + "." + nodeId + " has " + outEdges.length + " arrows");
      if (
        !outEdges.length &&
        ![NODE_KIND.ACTION, NODE_KIND.JUMP, NODE_KIND.NOTE].includes(kind)
      )
        fail(pageKey + "." + nodeId + " (" + kind + ") has no arrow out");
    }
}
// The card's pre/cpre keys resolve (the engine throws on an unknown key).
function checkCardPreconditions(state, card) {
  if (card.pre) {
    try {
      engine.precondition(state, card.id);
    } catch (error) {
      fail(card.id + ' pre "' + card.pre + '": ' + error.message);
    }
  }
  if (card.cpre) {
    try {
      engine.combatPrecondition({ ...state, battle: { figures: {} } }, card);
    } catch (error) {
      fail(card.id + ' cpre "' + card.cpre + '": ' + error.message);
    }
  }
}
// The card's deck, effect and onTable flags are consistent with each other and with the condition text.
function checkCardEffectFlags(card) {
  if (card.deck === engine.DECK.CALL_TO_BATTLE && !card.faction)
    fail(card.id + " Call to Battle card without a faction");
  if (card.effect && !Object.keys(engine.CARD_EFFECTS).includes(card.effect))
    fail(card.id + " unknown effect " + card.effect);
  if (card.effect === engine.CARD_EFFECT.RECRUIT_FACTION && !card.faction)
    fail(card.id + " recruitFaction without a faction");
  if (!!card.onTable !== /play on the table/i.test(card.cond || ""))
    fail(card.id + " onTable flag disagrees with its condition text");
}
// Every card flag key exists; every card the engine expects has its data; onTable agrees with the condition text (a transcription guard).
function checkCardFlags(state) {
  for (const card of fakeWindow.QB_CARDS) {
    checkCardPreconditions(state, card);
    checkCardEffectFlags(card);
  }
}
function main() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  const nodeKeys = checkNodeKeysExist();
  checkCardCriteriaResolve(state);
  checkFlowchartShape();
  checkCardFlags(state);
  console.log(
    fails
      ? fails + " failure(s)"
      : "all checks passed (" + nodeKeys + " node keys checked)",
  );
  process.exit(fails ? 1 : 0);
}
main();
