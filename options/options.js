const baseUrlInput = document.getElementById("baseUrl");
const apiKeyInput = document.getElementById("apiKey");
const logWindowSecondsInput = document.getElementById("logWindowSeconds");
const tempAllowMinutesInput = document.getElementById("tempAllowMinutes");
const showAllowStatusInput = document.getElementById("showAllowStatus");
const uiLanguageSelect = document.getElementById("uiLanguage");
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
    "showAllowStatus",
    "uiLanguage",
  ],
  (data) => {
    baseUrlInput.value = data.baseUrl || "";
    apiKeyInput.value = data.apiKey || "";

    logWindowSecondsInput.value =
      typeof data.logWindowSeconds === "number" ? data.logWindowSeconds : 120;

    tempAllowMinutesInput.value =
      typeof data.tempAllowMinutes === "number" ? data.tempAllowMinutes : 30;

    showAllowStatusInput.checked =
      typeof data.showAllowStatus === "boolean" ? data.showAllowStatus : false;

    if (uiLanguageSelect) {
      uiLanguageSelect.value = data.uiLanguage || "system";
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
      showAllowStatus: !!showAllowStatusInput.checked,
      uiLanguage: uiLanguageSelect ? uiLanguageSelect.value : "system",
    },
    () => {
      status.textContent = t("options_saved");
      setTimeout(() => (status.textContent = ""), 2000);

      // Apply language switch immediately
      if (window.TAC_I18N) {
        window.TAC_I18N.init().then(() => window.TAC_I18N.localizePage());
      }
    },
  );
});

// Init i18n
(async () => {
  if (window.TAC_I18N) {
    await window.TAC_I18N.init();
    window.TAC_I18N.localizePage();
  }
})();
