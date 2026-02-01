(() => {
  const SUPPORTED = ["en", "de"];

  let currentLocale = "en";
  let catalog = {};

  function systemLocale() {
    try {
      const lang = (
        (chrome && chrome.i18n && chrome.i18n.getUILanguage
          ? chrome.i18n.getUILanguage()
          : navigator.language) || "en"
      ).toLowerCase();
      return lang.slice(0, 2);
    } catch {
      return "en";
    }
  }

  async function loadCatalog(locale) {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`i18n load failed: ${res.status}`);
    const json = await res.json();
    const map = {};
    for (const [k, v] of Object.entries(json || {})) {
      if (v && typeof v.message === "string") map[k] = v.message;
    }
    return map;
  }

  function format(msg, subs) {
    if (!subs) return msg;
    const arr = Array.isArray(subs) ? subs : [subs];
    let out = msg;
    arr.forEach((s, i) => {
      out = out.split(`$${i + 1}`).join(String(s));
    });
    return out;
  }

  function t(key, subs) {
    const msg = catalog[key] || key;
    return format(msg, subs);
  }

  function localizePage(root = document) {
    // textContent
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });

    // innerHTML (use sparingly for trusted strings)
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });

    // placeholder
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    // title
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });

    // aria-label
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });

    // document title
    const titleEl = root.querySelector("meta[data-i18n-doc-title]");
    if (titleEl) {
      document.title = t(titleEl.dataset.i18nDocTitle);
    }
  }

  async function init() {
    const data = await chrome.storage.local.get({ uiLanguage: "system" });
    const pref = data.uiLanguage || "system";

    let locale = pref === "system" ? systemLocale() : String(pref).toLowerCase();
    if (!SUPPORTED.includes(locale)) locale = "en";

    currentLocale = locale;
    catalog = await loadCatalog(locale);

    try {
      document.documentElement.lang = locale;
    } catch {}

    return { locale: currentLocale, pref };
  }

  window.TAC_I18N = {
    init,
    t,
    localizePage,
    getLocale: () => currentLocale,
    getSupported: () => [...SUPPORTED],
  };
})();
