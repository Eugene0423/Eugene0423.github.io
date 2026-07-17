// src/securityEntry.js

import "./playground.css";
import { setupCanvasBoard } from "./js/canvas.js";
import { setupPosts } from "./js/posts.js";

const canvasBoard = setupCanvasBoard();

if (canvasBoard) {
  setupPosts(canvasBoard);
}