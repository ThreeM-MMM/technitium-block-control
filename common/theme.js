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
        // auto (follow prefers-color-scheme)
        delete document.documentElement.dataset.theme;
      }
    } catch {
      // ignore
    }
  }

  async function init() {
    try {
      const data = await chrome.storage.local.get({ uiTheme: "auto" });
      apply(data.uiTheme || "auto");
    } catch {
      // ignore
    }
  }

  // Expose minimal API for Options page immediate preview
  window.TAC_THEME = { init, apply };

  // Fire and forget
  init();
})();
