// The page entry point: the only module with side effects. window.QB and window.QBUI are for the devtools and the
// Playwright tests (test/smoke.js, test/shot.js).
import * as QB from "./qb.js";
import "./modals/index.js";
import * as ui from "./ui/index.js";

window.QB = QB;
window.QBUI = ui;
document.addEventListener("DOMContentLoaded", ui.boot);
