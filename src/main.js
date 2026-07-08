import "./style.css";

import { setupCanvasBoard } from "./js/canvas.js";
import { initVisitorGraph } from "./js/visitor.js";
import { showSecurityEvents } from "./js/security.js";

setupCanvasBoard();
initVisitorGraph();
showSecurityEvents();