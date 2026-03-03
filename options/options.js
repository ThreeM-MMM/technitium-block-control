const baseUrlInput = document.getElementById("baseUrl");
const apiKeyInput = document.getElementById("apiKey");
const logWindowSecondsInput = document.getElementById("logWindowSeconds");
const tempAllowMinutesInput = document.getElementById("tempAllowMinutes");
const uiLanguageSelect = document.getElementById("uiLanguage");
const uiThemeSelect = document.getElementById("uiTheme");
const status = document.getElementById("status");

const t = (key, subs) => {
  try {
    return window.TAC_I18N ? window.TAC_I18N.t(key, subs) : key;
  } catch {
    return key;
  }
};

function clampNumber(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.floor(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

chrome.storage.local.get(
  [
    "baseUrl",
    "apiKey",
    "logWindowSeconds",
    "tempAllowMinutes",
    "uiLanguage",
    "uiTheme",
  ],
  (data) => {
    baseUrlInput.value = data.baseUrl || "";
    apiKeyInput.value = data.apiKey || "";

    logWindowSecondsInput.value =
      typeof data.logWindowSeconds === "number" ? data.logWindowSeconds : 120;

    tempAllowMinutesInput.value =
      typeof data.tempAllowMinutes === "number" ? data.tempAllowMinutes : 30;

    if (uiLanguageSelect) {
      uiLanguageSelect.value = data.uiLanguage || "system";
    }

    if (uiThemeSelect) {
      uiThemeSelect.value = data.uiTheme || "auto";
    }
  },
);

document.getElementById("save").addEventListener("click", () => {
  const logWindowSeconds = clampNumber(
    logWindowSecondsInput.value,
    10,
    3600,
    120,
  );
  const tempAllowMinutes = clampNumber(
    tempAllowMinutesInput.value,
    1,
    1440,
    30,
  );

  chrome.storage.local.set(
    {
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      logWindowSeconds,
      tempAllowMinutes,
      uiLanguage: uiLanguageSelect ? uiLanguageSelect.value : "system",
      uiTheme: uiThemeSelect ? uiThemeSelect.value : "auto",
    },
    () => {
      status.textContent = t("options_saved");
      setTimeout(() => (status.textContent = ""), 2000);

      // Sprachwechsel sofort anwenden
      if (window.TAC_I18N) {
        window.TAC_I18N.init().then(() => window.TAC_I18N.localizePage());
      }

      // Theme-Wechsel sofort anwenden
      if (window.TAC_THEME && uiThemeSelect) {
        window.TAC_THEME.apply(uiThemeSelect.value || "auto");
      }
    },
  );
});

// Initialisiert die Internationalisierung (i18n)
(async () => {
  if (window.TAC_I18N) {
    await window.TAC_I18N.init();
    window.TAC_I18N.localizePage();
  }
})();
