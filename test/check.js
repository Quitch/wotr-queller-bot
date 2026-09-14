// Static consistency checks between walk.js / engine.js and the flowchart + card data. Exit 1 on any failure.
const fs = require("node:fs"),
  path = require("node:path");
const fakeWindow = require("./load.js")();
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
// 1. every "PAGE.node" key in walk.js names a real node
const walkSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "walk.js"),
  "utf8",
);
for (const match of walkSource.matchAll(/"([A-Z0-9]+)\.([A-Za-z0-9]+)"/g)) {
  const [, pageKey, nodeId] = match;
  if (FLOW[pageKey] && !FLOW[pageKey].nodes[nodeId])
    fail("walk.js refers to missing node " + pageKey + "." + nodeId);
}
// 2. every criterion on a card priority list is understood by criterionTest
const state = engine.newState({
  dice: true,
  cards: true,
  tracker: true,
  wome: true,
});
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
// 3. every grey box has a JUMPS entry; every decision has two arrows; every non-action box has a way out
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
// 4. every card flag key exists; every card the engine expects has its data
for (const card of fakeWindow.QB_CARDS) {
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
  if (card.deck === "B" && !card.faction)
    fail(card.id + " Call to Battle card without a faction");
  if (card.effect && !Object.values(engine.CARD_EFFECT).includes(card.effect))
    fail(card.id + " unknown effect " + card.effect);
  if (card.effect === "recruitFaction" && !card.faction)
    fail(card.id + " recruitFaction without a faction");
  if (!!card.onTable !== /play on the table/i.test(card.cond || ""))
    fail(card.id + " onTable flag disagrees with its condition text");
}
console.log(fails ? fails + " failure(s)" : "all checks passed");
process.exit(fails ? 1 : 0);
