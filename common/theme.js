(() => {
  function apply(mode) {
    try {
      if (mode === "dark") {
        document.documentElement.dataset.theme = "dark";
      } else if (mode === "gray") {
        document.documentElement.dataset.theme = "gray";
      } else if (mode === "light") {
        document.documentElement.dataset.theme = "light";
      } else {
        // "auto" (folgt den Systemeinstellungen via `prefers-color-scheme`)
        delete document.documentElement.dataset.theme;
      }
    } catch {
      // Fehler ignorieren
    }
  }

  async function init() {
    try {
      const data = await chrome.storage.local.get({ uiTheme: "auto" });
      apply(data.uiTheme || "auto");
    } catch {
      // Fehler ignorieren
    }
  }

  // Stellt eine minimale API für die sofortige Vorschau auf der Optionsseite bereit.
  window.TAC_THEME = { init, apply };

  // Initialisierung ohne auf das Ergebnis zu warten.
  init();
})();
