// The page entry point: the only module with side effects. window.QB and window.QBUI are for the devtools and the
// Playwright tests (test/smoke.js, test/shot.js).
import * as QB from "./qb.js";
// modals.js and ui.js import each other. Importing modals.js first makes ui.js evaluate before it, which modals.js needs
// (it builds its tables from MODAL while evaluating); ui.js only calls into modals.js later.
import "./modals.js";
import * as ui from "./ui.js";

window.QB = QB;
window.QBUI = ui;
document.addEventListener("DOMContentLoaded", ui.boot);
