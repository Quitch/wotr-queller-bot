// The jump modal: walk any page from any start point, with or without a die.
import { FLOW, NODE, NODE_KIND } from "../flow/index.js";
import * as engine from "../qb.js";
import { escapeHTML as esc } from "../ui/dom.js";
import * as ui from "../ui/index.js";
import { closeModal } from "./framework.js";

const jumpContent = () => ({
  title: "Walk from another start point",
  body: jumpHTML(),
  narrow: true,
});
function jumpHTML() {
  let html =
    '<div class="body"><p class="notice">Walk a page from any green start point — for example when a card tells Queller to make a choice (rule 12), to place Nazgûl, or to choose a discard. The walk uses no die unless you pick one.</p><div class="jumpgrid"><select id="jumpSel" aria-label="Start point">';
  for (const pageKey in FLOW) {
    for (const id in FLOW[pageKey].nodes) {
      const node = FLOW[pageKey].nodes[id];
      if (NODE.kind(node) === NODE_KIND.START)
        html +=
          '<option value="' +
          pageKey +
          "|" +
          id +
          '">' +
          esc(FLOW[pageKey].name) +
          " — " +
          esc(engine.normalizeText(NODE.text(node))) +
          "</option>";
    }
  }
  html +=
    '</select><select id="jumpDie" aria-label="Die to use"><option value="">No die</option>' +
    Object.keys(engine.DIE_REQUIREMENT_NAME)
      .map(
        (requirement) =>
          '<option value="' +
          requirement +
          '">' +
          esc(engine.DIE_REQUIREMENT_NAME[requirement]) +
          " die</option>",
      )
      .join("") +
    '</select></div><div style="margin-top:12px"><button class="btn primary" id="jumpGo">Walk</button></div></div>';
  return html;
}
function wireJumpModal(modal, el) {
  el.querySelector("#jumpGo").onclick = () => {
    const [pageKey, id] = el.querySelector("#jumpSel").value.split("|");
    const die = el.querySelector("#jumpDie").value || null;
    ui.act(
      () => {
        ui.state.walk = null;
        engine.startWalk(
          ui.state,
          pageKey,
          NODE.text(FLOW[pageKey].nodes[id]),
          { die },
        );
        closeModal();
      },
      { action: "jump", page: pageKey, start: id, die },
    );
  };
}

// What the modal framework needs to show this modal.
export const jump = {
  content: jumpContent,
  wire: wireJumpModal,
};
