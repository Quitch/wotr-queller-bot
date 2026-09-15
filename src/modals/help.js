// The help modal.
import * as ui from "../ui/index.js";

const helpContent = () => ({ title: "Help", body: helpHTML(), narrow: true });
function helpHTML() {
  return (
    '<div class="body"><div class="notice" style="max-width:75ch;font-size:.9rem;color:var(--ink)">' +
    "<h3>What this app does</h3><p>It plays the Shadow side using the Queller Bot. You play the Free Peoples on your physical copy of War of the Ring. The app rolls Queller’s dice, holds its cards and asks you the yes/no questions from the flowcharts; you answer from the board and carry out the action it names.</p>" +
    "<h3>A turn</h3><p>The buttons at the top of the walkthrough are the green start points of the flowcharts, in turn order: Phase 1 (dice and cards), Phase 2 (strategy check, corruption strategy only), Phase 3 (Hunt box), Phase 4 (roll), then “Phase 5” each time Queller is eligible to act. When a battle starts, use “Battle” for the first round; the button becomes “Battle (next round)” while the battle continues. “Phase 6” is the victory check; the next turn then begins at Phase 1.</p>" +
    "<h3>Answering</h3><p>Each step is coloured like the paper flowchart and named in the line above it: a decision asks a question, an action tells you what Queller does (press Done, or Not possible if the game rules prevent it), a step is something to do before continuing. Italic terms show their definition when you hover, focus or tap them; press Enter or tap again to open the glossary at that term.</p>" +
    "<h3>The board tracker</h3><p>Keep it up to date: it answers questions about the Fellowship, minions, nations and factions for you, and decides which of Queller’s cards can be played without showing you the rest of the hand. Card checks it asks you about are remembered for the turn; press Forget if the board has changed.</p>" +
    "<h3>Mistakes</h3><p>Undo reverses your last action (up to " +
    ui.UNDO_DEPTH +
    " steps). The game is saved automatically in this browser; Save / Load keeps named copies or moves a game to another device.</p>" +
    "<h3>Reporting a bug</h3><p>If the app itself goes wrong — a step that makes no sense, a card or die handled wrongly, a button that does nothing — open Settings and press Export debug log. The log holds the game state, the last actions you took and any errors; send it with a short description of what you expected. It also shows Queller’s hidden cards, so only read it if you do not mind seeing them.</p>" +
    "<h3>Abbreviations</h3><p>WoME: Warriors of Middle-earth. VP: victory points. FP: Free Peoples.</p></div></div>"
  );
}

// What the modal framework needs to show this modal.
export const help = {
  content: helpContent,
};
