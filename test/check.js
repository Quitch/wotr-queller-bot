// Static consistency checks between walk.js / engine.js and the flowchart + card data. Exit 1 on any failure.
const fs = require("node:fs"),
  path = require("node:path");
const fakeWindow = require("./load.js")();
const FLOW = fakeWindow.QB_FLOW,
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
const cardLists = [
  "C14.disc14",
  "C14.disc18",
  "C14.discF",
  "M14.disc",
  "M14.discF",
  "EV.prefPri",
  "EV.anyPri",
  "EV.discPri",
  "FA.playPri",
  "FA.discPri",
  "BA.sortiePri",
  "BA.wkPri",
  "BA.atkPri",
  "BA.defPri",
];
for (const nodeKey of cardLists) {
  const [pageKey, nodeId] = nodeKey.split(".");
  const node = FLOW[pageKey]?.nodes[nodeId];
  if (!node) {
    fail("card list " + nodeKey + " missing");
    continue;
  }
  for (const criterion of node[6].items)
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
    const outEdges = FLOW[pageKey].edges.filter((edge) => edge[0] === nodeId);
    if (node[0] === "J" && !engine.jumpSpec(node[5]))
      fail(
        "no JUMPS entry for " +
          pageKey +
          "." +
          nodeId +
          ' "' +
          engine.normalizeText(node[5]) +
          '"',
      );
    if ((node[0] === "D" || node[0] === "d") && outEdges.length !== 2)
      fail(pageKey + "." + nodeId + " has " + outEdges.length + " arrows");
    if (!outEdges.length && !["A", "J", "N"].includes(node[0]))
      fail(pageKey + "." + nodeId + " (" + node[0] + ") has no arrow out");
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
  if (
    card.effect &&
    !["servants", "hisWill", "lidlessEye", "recruitFaction"].includes(
      card.effect,
    )
  )
    fail(card.id + " unknown effect " + card.effect);
  if (card.effect === "recruitFaction" && !card.faction)
    fail(card.id + " recruitFaction without a faction");
  if (!!card.onTable !== /play on the table/i.test(card.cond || ""))
    fail(card.id + " onTable flag disagrees with its condition text");
}
console.log(fails ? fails + " failure(s)" : "all checks passed");
process.exit(fails ? 1 : 0);
