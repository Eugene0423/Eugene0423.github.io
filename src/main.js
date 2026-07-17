import "./style.css";

import { initVisitorGraph } from "./js/visitor.js";
import { setupAdminLogin, setupAdminLogout } from "./js/auth.js";

initVisitorGraph();

document.addEventListener("DOMContentLoaded", function () {
  const menuDropdown = document.getElementById("menuDropdown");
  const menuButton = document.getElementById("menuButton");

  if (menuDropdown && menuButton) {
    menuButton.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      menuDropdown.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
      if (!menuDropdown.contains(event.target)) {
        menuDropdown.classList.remove("open");
      }
    });
  }
});

setupAdminLogin();
setupAdminLogout();