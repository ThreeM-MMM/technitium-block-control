const state = document.getElementById("state");
const toggle = document.getElementById("toggle");
const timerState = document.getElementById("timerState");
const toolbarSub = document.querySelector(".toolbarSub");

const customMinutesInput = document.getElementById("customMinutes");
const startCustomBtn = document.getElementById("startCustom");

const refreshAllBtn = document.getElementById("refreshAll");
const toggleSinceLoad = document.getElementById("toggleSinceLoad");
const toggleOnlyHits = document.getElementById("toggleOnlyHits");

const pageStatus = document.getElementById("pageStatus");
const pageBlockedList = document.getElementById("pageBlockedList");
const blockedList = document.getElementById("blockedList");
const themeToggleBtn = document.getElementById("themeToggle");


const t = (key, subs) => {
  try {
    return window.TAC_I18N ? window.TAC_I18N.t(key, subs) : key;
  } catch {
    return key;
  }
};

const THEME_CYCLE = ["light", "gray", "dark"];
const THEME_ICON = {
  light: "☀",
  gray: "☾",
  dark: "✦",
};

function nextThemeMode(mode) {
  const idx = THEME_CYCLE.indexOf(mode);
  return THEME_CYCLE[(idx + 1 + THEME_CYCLE.length) % THEME_CYCLE.length] || 'light';
}

function resolvedThemeMode(stored) {
  if (stored === "light" || stored === "gray" || stored === "dark") return stored;
  // auto (follow system/browser)
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

async function refreshThemeToggle() {
  if (!themeToggleBtn) return;
  try {
    const data = await chrome.storage.local.get({ uiTheme: 'auto' });
    const current = resolvedThemeMode(data.uiTheme || 'auto');
    const next = nextThemeMode(current);
    // Show the NEXT theme icon (what clicking will switch to)
    themeToggleBtn.textContent = THEME_ICON[next] || '☀';
  } catch {
    // ignore
  }
}

async function cycleTheme() {
  try {
    const data = await chrome.storage.local.get({ uiTheme: 'auto' });
    const current = resolvedThemeMode(data.uiTheme || 'auto');
    const next = nextThemeMode(current);

    await chrome.storage.local.set({ uiTheme: next });

    // Apply immediately in this popup
    if (window.TAC_THEME && window.TAC_THEME.apply) {
      window.TAC_THEME.apply(next);
    } else {
      document.documentElement.dataset.theme = next;
    }

    // After switching, show icon for the NEXT theme (the next click action)
    const after = nextThemeMode(next);
    themeToggleBtn.textContent = THEME_ICON[after] || '☀';
  } catch {
    // ignore
  }
}

const LAST_MINUTES_KEY = "lastCustomMinutes";
const UI_SINCE_LOAD_KEY = "uiSinceLoad";
const UI_ONLY_HITS_KEY = "uiOnlyHits";

function send(action, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...extra }, (res) => resolve(res));
  });
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data));
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderTimer(tempUntil) {
  if (!timerState) return;

  if (!tempUntil) {
    timerState.textContent = "";
    if (toolbarSub) toolbarSub.style.display = "none";
    return;
  }

  const now = Date.now();
  const leftMs = tempUntil - now;

  if (leftMs <= 0) {
    timerState.textContent = "";
    if (toolbarSub) toolbarSub.style.display = "none";
    return;
  }

  const leftMin = Math.ceil(leftMs / 60000);
  timerState.textContent = t("popup_temp_until", [fmtTime(tempUntil), leftMin]);
  if (toolbarSub) toolbarSub.style.display = "flex";
}

function clampMinutes(n) {
  if (!Number.isFinite(n)) return null;
  const m = Math.floor(n);
  if (m < 1) return 1;
  if (m > 1440) return 1440;
  return m;
}

function normalizeDomain(s) {
  if (!s) return null;
  return String(s).trim().toLowerCase().replace(/\.$/, "");
}

function hostMatchesBlocked(host, blockedDomain) {
  const h = normalizeDomain(host);
  const d = normalizeDomain(blockedDomain);
  if (!h || !d) return false;
  return h === d || h.endsWith("." + d);
}

function baseDomain(hostname) {
  const h = normalizeDomain(hostname);
  if (!h) return null;
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

// Resource type badges (derived from performance entries)
const TYPE_LABEL = {
  img: "IMG",
  image: "IMG",
  script: "JS",
  css: "CSS",
  link: "LINK",
  font: "FONT",
  fetch: "XHR",
  xmlhttprequest: "XHR",
  beacon: "BEACON",
  iframe: "FRAME",
  frame: "FRAME",
  audio: "MEDIA",
  video: "MEDIA",
  other: "OTHER",
};

const TYPE_PRIORITY = [
  "img",
  "image",
  "script",
  "css",
  "font",
  "fetch",
  "xmlhttprequest",
  "iframe",
  "frame",
  "audio",
  "video",
  "link",
  "beacon",
  "other",
];

function typeLabelsForDomain(blockedDomain, hostTypesObj) {
  const out = new Set();
  for (const [host, types] of Object.entries(hostTypesObj || {})) {
    if (!hostMatchesBlocked(host, blockedDomain)) continue;
    for (const t of types || []) {
      const key = String(t || "other").toLowerCase();
      out.add(TYPE_LABEL[key] || TYPE_LABEL.other);
    }
  }

  // Order by priority of underlying types (stable, predictable)
  const ordered = [];
  const seen = new Set();
  for (const pri of TYPE_PRIORITY) {
    const label = TYPE_LABEL[pri];
    if (!label || !out.has(label) || seen.has(label)) continue;
    ordered.push(label);
    seen.add(label);
  }
  // Any remaining labels (unknown types) at the end
  for (const label of out) {
    if (!seen.has(label)) ordered.push(label);
  }

  // Keep UI compact: show up to 2 labels, then +N
  if (ordered.length <= 2) return ordered;
  return [ordered[0], ordered[1], `+${ordered.length - 2}`];
}

function isRestrictedUrl(url) {
  if (!url) return true;
  const u = url.toLowerCase();

  // Optional file:// support via Extension setting
  // (User muss in chrome://extensions -> Details -> "Zugriff auf Datei-URLs erlauben" aktivieren)
  if (u.startsWith("file://")) return false;

  return (
    u.startsWith("chrome://") ||
    u.startsWith("chrome-extension://") ||
    u.startsWith("vivaldi://") ||
    u.startsWith("edge://") ||
    u.startsWith("brave://") ||
    u.startsWith("about:")
  );
}

let timerInterval = null;

async function loadLastMinutes() {
  const data = await storageGet([LAST_MINUTES_KEY]);
  const last = data[LAST_MINUTES_KEY];
  customMinutesInput.value =
    typeof last === "number" && last >= 1 && last <= 1440 ? String(last) : "5";
}

async function loadUiToggles() {
  const data = await storageGet([UI_SINCE_LOAD_KEY, UI_ONLY_HITS_KEY]);
  toggleSinceLoad.checked = !!data[UI_SINCE_LOAD_KEY];
  toggleOnlyHits.checked = !!data[UI_ONLY_HITS_KEY];
}

async function refreshStatus() {
  const res = await send("status");

  if (res?.error) {
    state.classList.remove("status-on", "status-off");
    state.textContent = res.error;
    toggle.style.display = "none";
    return;
  }

  const enabled = !!res.enableBlocking;
  state.classList.toggle("status-on", enabled);
  state.classList.toggle("status-off", !enabled);

  // Visualize status with an emoji (fallback is still readable as text)
  // Requested: ✅ for enabled, ⛔ for disabled
  const emoji = enabled ? "✅" : "⛔";
  state.textContent = `${emoji} ${enabled ? t("popup_state_on") : t("popup_state_off")}`;

  toggle.textContent = enabled ? t("popup_btn_disable") : t("popup_btn_enable");
  toggle.style.display = "inline-block";

  toggle.onclick = async () => {
    await send(enabled ? "disable" : "enable");
    await refreshStatus();
    await refreshAll();
  };

  const tempUntil = res.tempUntil || null;
  renderTimer(tempUntil);

  if (timerInterval) clearInterval(timerInterval);
  if (tempUntil) {
    timerInterval = setInterval(() => renderTimer(tempUntil), 1000);
  }
}

async function startCustomTimer() {
  const minutes = clampMinutes(Number(customMinutesInput.value));
  if (!minutes) return;

  await storageSet({ [LAST_MINUTES_KEY]: minutes });
  await send("tempDisable", { minutes });
  await refreshStatus();
}

// ===== Page Snapshot =====

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
}

async function collectPageSnapshot(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const hostTypes = new Map();
      for (const e of performance.getEntriesByType("resource")) {
        try {
          const u = new URL(e.name, location.href);
          const host = u.hostname.toLowerCase();
          if (!host) continue;
          const type = String(e.initiatorType || "other").toLowerCase();
          let set = hostTypes.get(host);
          if (!set) {
            set = new Set();
            hostTypes.set(host, set);
          }
          set.add(type);
        } catch {}
      }

      const hostTypesObj = {};
      for (const [host, set] of hostTypes.entries()) {
        hostTypesObj[host] = Array.from(set);
      }

      return {
        pageHost: location.hostname.toLowerCase(),
        pageStartEpoch: Date.now() - performance.now(),
        hosts: Object.keys(hostTypesObj),
        hostTypes: hostTypesObj,
      };
    },
  });

  return result;
}

// ===== Rendering =====

function renderList(
  container,
  items,
  pageHost,
  allowedMap,
  typesByDomain,
  { onAllow, onRemoveAllow, onTempAllow },
) {
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    return;
  }

  const pageBase = baseDomain(pageHost);

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "rowItem";

    // Hot marker (ab 20)
    if ((it.count || 0) >= 20) row.classList.add("hot");

    const left = document.createElement("div");
    left.className = "left";

    const domain = document.createElement("div");
    domain.className = "domain";
    domain.textContent = it.domain;

    const count = document.createElement("div");
    count.className = "count";
    count.textContent = `${it.count}×`;

    const dBase = baseDomain(it.domain);
    if (pageBase && dBase && pageBase !== dBase) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t("tag_third_party");
      count.appendChild(tag);
    }

    // Resource type badges (IMG/JS/CSS/...) if we can infer them from the tab's resource timings
    const typeLabels = typesByDomain?.[it.domain] || [];
    for (const lbl of typeLabels) {
      const tag = document.createElement("span");
      tag.className = "tag type";
      tag.textContent = lbl;
      count.appendChild(tag);
    }

    left.appendChild(domain);
    left.appendChild(count);

    const btnWrap = document.createElement("div");
    btnWrap.className = "btnRow";

    const isAllowed = !!allowedMap?.[normalizeDomain(it.domain)];
    if (isAllowed) row.classList.add("allowed");

    const primaryBtn = document.createElement("button");
    primaryBtn.className = "actionBtn";

    if (isAllowed) {
      primaryBtn.textContent = t("btn_remove_allow");
      primaryBtn.onclick = () => onRemoveAllow(it.domain);
    } else {
      primaryBtn.textContent = t("btn_allow");
      primaryBtn.onclick = () => onAllow(it.domain);
    }

    btnWrap.appendChild(primaryBtn);

    // Temp Allow nur wenn nicht already allowed
    if (!isAllowed) {
      const btnTemp = document.createElement("button");
      btnTemp.className = "actionBtn";
      btnTemp.textContent = t("btn_temp_allow");
      btnTemp.onclick = () => onTempAllow(it.domain);
      btnWrap.appendChild(btnTemp);
    }

    row.appendChild(left);
    row.appendChild(btnWrap);
    container.appendChild(row);
  }
}

// ===== Main Refresh =====

async function refreshAll() {
  pageStatus.textContent = "";

  async function doDomainAction(action, domain, extra = {}) {
    pageStatus.textContent = "";
    try {
      const res = await send(action, { domain, ...extra });
      if (res?.error) {
        pageStatus.textContent = t("popup_error_prefix", [res.error]);
        return false;
      }
      return true;
    } catch (e) {
      pageStatus.textContent = t("popup_error_prefix", [e?.message || e]);
      return false;
    }
  }

  const tab = await getActiveTab();
  if (!tab || isRestrictedUrl(tab.url)) {
    pageStatus.textContent = t("popup_page_cannot_analyze");
    pageBlockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    blockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    return;
  }

  let snapshot;
  try {
    snapshot = await collectPageSnapshot(tab.id);
  } catch {
    pageStatus.textContent = t("popup_analysis_not_possible");
    pageBlockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    blockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    return;
  }

  const sinceLoad = toggleSinceLoad.checked;

  let blockedRes;
  try {
    if (sinceLoad) {
      const start = new Date(snapshot.pageStartEpoch - 2000).toISOString();
      const end = new Date().toISOString();
      blockedRes = await send("blockedList", { startIso: start, endIso: end });
    } else {
      blockedRes = await send("blockedList", { seconds: 120 });
    }
  } catch (e) {
    blockedRes = { error: e?.message || t("popup_generic_error") };
  }

  if (blockedRes?.error) {
    pageStatus.textContent = t("popup_error_prefix", [blockedRes.error]);
    pageBlockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    blockedList.innerHTML = `<div class="empty">${t("popup_empty")}</div>`;
    return;
  }

  const allItems = blockedRes.items || [];
  const pageHosts = snapshot.hosts || [];

  // Precompute resource type badges per blocked domain (if possible)
  const typesByDomain = {};
  const hostTypesObj = snapshot.hostTypes || {};
  for (const it of allItems) {
    typesByDomain[it.domain] = typeLabelsForDomain(it.domain, hostTypesObj);
  }

  const pageRelevant = allItems.filter((it) =>
    pageHosts.some((h) => hostMatchesBlocked(h, it.domain)),
  );

  // Allow-Status optional (per option) – wir fragen batch an
  const domainsForCheck = Array.from(new Set(allItems.map((x) => x.domain)));
  const allowStatusRes = await send("allowedStatusBatch", {
    domains: domainsForCheck,
  });
  const allowedMap = allowStatusRes?.enabled
    ? allowStatusRes.allowed || {}
    : {};

  renderList(pageBlockedList, pageRelevant, snapshot.pageHost, allowedMap, typesByDomain, {
    onAllow: (d) =>
      doDomainAction("allowDomain", d).then((ok) => ok && refreshAll()),
    onRemoveAllow: (d) =>
      doDomainAction("removeAllowDomain", d).then((ok) => ok && refreshAll()),
    onTempAllow: (d) =>
      doDomainAction("tempAllowDomain", d).then((ok) => ok && refreshAll()),
  });

  if (!toggleOnlyHits.checked) {
    renderList(blockedList, allItems, snapshot.pageHost, allowedMap, typesByDomain, {
      onAllow: (d) =>
        doDomainAction("allowDomain", d).then((ok) => ok && refreshAll()),
      onRemoveAllow: (d) =>
        doDomainAction("removeAllowDomain", d).then((ok) => ok && refreshAll()),
      onTempAllow: (d) =>
        doDomainAction("tempAllowDomain", d).then((ok) => ok && refreshAll()),
    });
  } else {
    blockedList.innerHTML = `<div class="empty">${t("popup_hidden_only_hits")}</div>`;
  }
}

// ===== Wiring =====

startCustomBtn.addEventListener("click", startCustomTimer);
refreshAllBtn.addEventListener("click", refreshAll);

toggleSinceLoad.addEventListener("change", async () => {
  await storageSet({ [UI_SINCE_LOAD_KEY]: !!toggleSinceLoad.checked });
  await refreshAll();
});

toggleOnlyHits.addEventListener("change", async () => {
  await storageSet({ [UI_ONLY_HITS_KEY]: !!toggleOnlyHits.checked });
  await refreshAll();
});

// Init
(async () => {
  await window.TAC_I18N.init();
  window.TAC_I18N.localizePage();


    // Theme toggle button
    if (themeToggleBtn) {
      await refreshThemeToggle();
      themeToggleBtn.addEventListener("click", cycleTheme);
    }

    // Update icon if theme changes elsewhere
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.uiTheme) refreshThemeToggle();
      });
    }
  await loadLastMinutes();
  await loadUiToggles();
  await refreshStatus();
  await refreshAll();
})();
