// background/serviceWorker.js
// Dieses Skript läuft im Hintergrund und steuert die Kernlogik der Extension.

import {
  getDnsSettings,
  setEnableBlocking,
  temporaryDisableBlocking,
  listApps,
  queryLogs,
  allowZone,
  deleteAllowedZone,
  deleteCachedZone,
  listAllowed,
} from "./technitiumApi.js";

const TIMER_ALARM = "reEnableBlocking";

const CLIENT_IP_CACHE_KEY = "clientIpAddress";
const CLIENT_IP_CACHE_TS_KEY = "clientIpDetectedAt";
const QUERY_LOGGER_CACHE_KEY = "queryLoggerApp"; // Zwischenspeicher für die Query Logger App { name, classPath }
const CLIENT_IP_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

const TEMP_ALLOW_MINUTES_KEY = "tempAllowMinutes";
const LOG_WINDOW_SECONDS_KEY = "logWindowSeconds";

const TEMP_ALLOW_PREFIX = "tempAllow::"; // Präfix für Alarme zur temporären Freigabe
const TEMP_ALLOW_STATE_KEY = "tempAllowState"; // Speicherschlüssel für den Zustand der temporären Freigaben: { [domain]: expiresTs }

// Stellt geplante Zustände (Alarme) nach einem Browser-Neustart oder einer Neuinstallation der Extension wieder her.
// Service Worker in MV3 sind nicht persistent; sich allein auf den In-Memory-Zustand oder gespeicherte Alarme zu verlassen, ist fehleranfällig.
// Daher stellen wir Timer- und Temp-Allow-Alarme aus chrome.storage.local wieder her.
async function restoreScheduledState() {
  const now = Date.now();

  // 1) Wiederherstellung des Timers für die temporäre Deaktivierung des Blockings
  const { blockingTempUntil } =
    await chrome.storage.local.get("blockingTempUntil");

  await chrome.alarms.clear(TIMER_ALARM);
  if (blockingTempUntil && Number.isFinite(blockingTempUntil)) {
    if (blockingTempUntil > now) {
      await chrome.alarms.create(TIMER_ALARM, { when: blockingTempUntil });
    } else {
      await clearTimerState();
    }
  }

  // 2) Wiederherstellung der temporären Freigaben für einzelne Domains
  const state = await getTempAllowState();
  const entries = Object.entries(state);
  if (entries.length === 0) return;

  for (const [domain, expiresTs] of entries) {
    const when = Number(expiresTs);
    if (!Number.isFinite(when)) {
      // Beschädigter Eintrag -> wird entfernt
      delete state[domain];
      continue;
    }

    const alarmName = `${TEMP_ALLOW_PREFIX}${domain}`;
    await chrome.alarms.clear(alarmName);

    if (when <= now) {
      // Abgelaufen, während die Extension nicht lief -> jetzt aufräumen.
      try {
        await removeTempAllow(domain);
        delete state[domain];
      } catch (e) {
        console.warn(
          "[Technitium] Temp allow cleanup (startup) failed:",
          domain,
          e,
        );
      }
      continue;
    }

    await chrome.alarms.create(alarmName, { when });
  }

  // Alle Aufräumarbeiten, die oben durchgeführt wurden, jetzt speichern.
  await setTempAllowState(state);
}

async function setTimerState(untilTs) {
  await chrome.storage.local.set({ blockingTempUntil: untilTs });
}

async function clearTimerState() {
  await chrome.storage.local.remove(["blockingTempUntil"]);
}

// --- Hilfsfunktionen für den Temp-Allow-Zustand ---
// Temp Allow = wir fügen eine Domain zu den "Allowed Zones" hinzu und entfernen sie später wieder.
async function getTempAllowState() {
  const data = await chrome.storage.local.get(TEMP_ALLOW_STATE_KEY);
  return data[TEMP_ALLOW_STATE_KEY] || {};
}

async function setTempAllowState(state) {
  await chrome.storage.local.set({ [TEMP_ALLOW_STATE_KEY]: state });
}

async function removeTempAllow(domain) {
  await deleteAllowedZone(domain);
  try {
    await deleteCachedZone(domain);
  } catch (_) {}

  const state = await getTempAllowState();
  delete state[domain];
  await setTempAllowState(state);
}

// Stellt Alarme/Zustände nach Installation, Update oder Browser-Neustart wieder her.
chrome.runtime.onInstalled.addListener(() => {
  restoreScheduledState().catch((e) =>
    console.warn("[Technitium] restoreScheduledState (onInstalled) failed:", e),
  );
});

chrome.runtime.onStartup.addListener(() => {
  restoreScheduledState().catch((e) =>
    console.warn("[Technitium] restoreScheduledState (onStartup) failed:", e),
  );
});

// --- Alarm-Listener ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TIMER_ALARM) {
    try {
      await setEnableBlocking(true);
    } catch (e) {
      console.error("[Technitium] Re-enable after timer failed:", e);
    } finally {
      await clearTimerState();
    }
    return;
  }

  if (alarm.name.startsWith(TEMP_ALLOW_PREFIX)) {
    const domain = alarm.name.slice(TEMP_ALLOW_PREFIX.length);
    try {
      await removeTempAllow(domain);
    } catch (e) {
      console.error("[Technitium] Temp allow cleanup failed:", domain, e);
    }
  }
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOptionNumber(key, defaultValue) {
  const data = await chrome.storage.local.get(key);
  const v = data[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return defaultValue;
}

async function getOptionBool(key, defaultValue = false) {
  const data = await chrome.storage.local.get(key);
  const v = data[key];
  if (typeof v === "boolean") return v;
  return defaultValue;
}

async function getCachedQueryLogger() {
  const data = await chrome.storage.local.get(QUERY_LOGGER_CACHE_KEY);
  const q = data[QUERY_LOGGER_CACHE_KEY];
  if (q?.name && q?.classPath) return q;
  return null;
}

async function setCachedQueryLogger(app) {
  await chrome.storage.local.set({ [QUERY_LOGGER_CACHE_KEY]: app });
}

async function detectQueryLoggerApp() {
  const cached = await getCachedQueryLogger();
  if (cached) return cached;

  const res = await listApps();
  const apps = res.response?.apps || [];

  for (const app of apps) {
    const dnsApps = app.dnsApps || [];
    for (const da of dnsApps) {
      if (da.isQueryLogger) {
        const found = { name: app.name, classPath: da.classPath };
        await setCachedQueryLogger(found);
        return found;
      }
    }
  }

  throw new Error("Kein Query Logger DNS App gefunden (apps/list).");
}

async function getCachedClientIp() {
  const data = await chrome.storage.local.get([
    CLIENT_IP_CACHE_KEY,
    CLIENT_IP_CACHE_TS_KEY,
  ]);
  const ip = data[CLIENT_IP_CACHE_KEY];
  const ts = data[CLIENT_IP_CACHE_TS_KEY];
  if (!ip || !ts) return null;
  if (Date.now() - ts > CLIENT_IP_TTL_MS) return null;
  return ip;
}

async function setCachedClientIp(ip) {
  await chrome.storage.local.set({
    [CLIENT_IP_CACHE_KEY]: ip,
    [CLIENT_IP_CACHE_TS_KEY]: Date.now(),
  });
}

// Trick: Wir erzeugen eine "fake" Web-Anfrage, damit der DNS-Server sie protokolliert.
// Anschließend suchen wir nach diesem qname in den `logs/query`-Ergebnissen und extrahieren die `clientIpAddress`.
async function inferClientIpFromLogs() {
  const cached = await getCachedClientIp();
  if (cached) return cached;

  const qname = `ttip-${Date.now()}-${Math.random().toString(16).slice(2)}.example.com`;

  try {
    await fetch(`https://${qname}/`, { mode: "no-cors" });
  } catch (_) {}

  await sleep(600);

  const ql = await detectQueryLoggerApp();

  const endIso = new Date().toISOString();
  const startIso = new Date(Date.now() - 30 * 1000).toISOString();

  const res = await queryLogs({
    name: ql.name,
    classPath: ql.classPath,
    entriesPerPage: 10,
    descendingOrder: true,
    startIso,
    endIso,
    qname,
  });

  const entries = res.response?.entries || [];
  const entry = entries.find(
    (e) => (e.qname || "").toLowerCase() === qname.toLowerCase(),
  );

  if (!entry?.clientIpAddress) {
    throw new Error(
      "Client-IP konnte nicht ermittelt werden (keine Log-Entry gefunden).",
    );
  }

  await setCachedClientIp(entry.clientIpAddress);
  return entry.clientIpAddress;
}

function normalizeDomain(qname) {
  if (!qname) return null;
  return String(qname).trim().toLowerCase().replace(/\.$/, "");
}

function isBlockedLogEntry(e) {
  // Heuristik zur Erkennung, ob ein Log-Eintrag einen geblockten Request darstellt:
  // - Der `responseType` enthält "blocked" (z.B. "Blocked", "CacheBlocked", "UpstreamBlocked").
  // - Oder der `RCODE` deutet auf `NXDOMAIN` hin (typisch für NXDOMAIN-Blocking).
  const rtRaw = e.responseType;
  const rt =
    typeof rtRaw === "string" ? rtRaw.toLowerCase() : String(rtRaw || "");
  const rcRaw = e.rcode || e.RCODE;
  const rc =
    typeof rcRaw === "string" ? rcRaw.toLowerCase() : String(rcRaw || "");

  if (rt.includes("blocked")) return true;
  if (rc.includes("nxdomain")) return true;

  return false;
}

function aggregateBlocked(entries) {
  const map = new Map(); // domain -> { domain, count, lastSeen }
  for (const e of entries) {
    if (!isBlockedLogEntry(e)) continue;

    const d = normalizeDomain(e.qname);
    if (!d) continue;

    const ts = e.timestamp || null;
    const prev = map.get(d);
    if (!prev) {
      map.set(d, { domain: d, count: 1, lastSeen: ts });
    } else {
      prev.count += 1;
      if (ts && (!prev.lastSeen || ts > prev.lastSeen)) prev.lastSeen = ts;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.domain.localeCompare(b.domain);
  });
}

async function findBlockedForDomain(domain, options = {}) {
  const dNorm = normalizeDomain(domain);
  if (!dNorm) return null;

  const ql = await detectQueryLoggerApp();

  let startIso;
  let endIso;

  if (options.startIso && options.endIso) {
    startIso = options.startIso;
    endIso = options.endIso;
  } else {
    const secondsDefault = await getOptionNumber(LOG_WINDOW_SECONDS_KEY, 120);
    const seconds = Math.max(10, Math.floor(options.seconds || secondsDefault));
    endIso = new Date().toISOString();
    startIso = new Date(Date.now() - seconds * 1000).toISOString();
  }

  const res = await queryLogs({
    name: ql.name,
    classPath: ql.classPath,
    entriesPerPage: 200,
    descendingOrder: true,
    startIso,
    endIso,
    qname: dNorm,
    // Hier wird absichtlich KEIN `clientIpAddress`-Filter verwendet.
    // `findBlockedForDomain` dient als robuste Fallback-Abfrage für eine spezifische Domain,
    // auch in Umgebungen, in denen die vom Query-Logger protokollierte Client-IP nicht
    // exakt mit der über `inferClientIpFromLogs` ermittelten IP übereinstimmt.
  });

  const entries = res.response?.entries || [];

  let count = 0;
  let lastSeen = null;

  for (const e of entries) {
    if (normalizeDomain(e.qname) !== dNorm) continue;
    if (!isBlockedLogEntry(e)) continue;
    count += 1;
    const ts = e.timestamp || null;
    if (ts && (!lastSeen || ts > lastSeen)) lastSeen = ts;
  }

  if (count === 0) return null;

  return { domain: dNorm, count, lastSeen };
}

// Heuristik: Wenn `/allowed/list?domain=X` ein sinnvolles Ergebnis zurückgibt,
// betrachten wir X als "erlaubt".
async function isDomainAllowed(domain) {
  const d = normalizeDomain(domain);
  if (!d) return false;

  const res = await listAllowed(d);
  const r = res.response || {};

  // In vielen Konfigurationen liefert `allowed/list` für eine existierende Allowed-Zone Records (z.B. SOA/NS).
  // Wenn sie nicht existiert, ist die Antwort oft `domain=root` oder `records` ist leer.
  const records = Array.isArray(r.records) ? r.records : [];
  const zones = Array.isArray(r.zones) ? r.zones : [];

  // Robuste Prüfung: "erlaubt", wenn entweder `records` oder `zones` vorhanden sind UND der Domain-Name (annähernd) passt.
  if (
    (records.length > 0 || zones.length > 0) &&
    String(r.domain || "")
      .toLowerCase()
      .includes(d)
  ) {
    return true;
  }

  // Fallback: Wenn `records` oder `zones` nicht leer sind, nehmen wir an, die Domain ist erlaubt.
  return records.length > 0 || zones.length > 0;
}

// Führt eine Batch-Überprüfung für mehrere Domains mit begrenzter Parallelität durch.
async function allowedStatusBatch(domains) {
  const list = (domains || []).map(normalizeDomain).filter(Boolean);
  const unique = Array.from(new Set(list));

  const allowed = {};
  const concurrency = 5;
  let idx = 0;

  async function worker() {
    while (idx < unique.length) {
      const i = idx++;
      const d = unique[i];
      try {
        allowed[d] = await isDomainAllowed(d);
      } catch (_) {
        allowed[d] = false;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, unique.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return { enabled: true, allowed };
}

// ===== Nachrichten-Listener =====
// Behandelt eingehende Nachrichten von anderen Teilen der Extension (z.B. dem Popup).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === "status") {
        const settings = await getDnsSettings();
        const enableBlocking = !!settings.response?.enableBlocking;

        const { blockingTempUntil } =
          await chrome.storage.local.get("blockingTempUntil");

        sendResponse({
          ok: true,
          enableBlocking,
          tempUntil: blockingTempUntil || null,
        });
        return;
      }

      if (msg.action === "enable") {
        await setEnableBlocking(true);
        await clearTimerState();
        await chrome.alarms.clear(TIMER_ALARM);
        sendResponse({ ok: true });
        return;
      }

      if (msg.action === "disable") {
        await setEnableBlocking(false);
        await clearTimerState();
        await chrome.alarms.clear(TIMER_ALARM);
        sendResponse({ ok: true });
        return;
      }

      if (msg.action === "tempDisable") {
        const minutes = Math.max(1, Math.floor(msg.minutes || 5));
        await temporaryDisableBlocking(minutes);

        const untilTs = Date.now() + minutes * 60 * 1000;
        await setTimerState(untilTs);

        await chrome.alarms.clear(TIMER_ALARM);
        await chrome.alarms.create(TIMER_ALARM, { when: untilTs });

        sendResponse({ ok: true, tempUntil: untilTs });
        return;
      }

      // ===== Liste der geblockten Domains abrufen =====
      if (msg.action === "blockedList") {
        // Wichtig: Wir filtern die Block-Liste nach der Client-IP,
        // damit in Multi-Client-Umgebungen nur die Anfragen des aktuellen Geräts angezeigt werden.
        // Die Client-IP wird über `inferClientIpFromLogs()` per "Magic IP"-Trick
        // gegen den Query-Logger ermittelt.
        const clientIp = await inferClientIpFromLogs();

        const ql = await detectQueryLoggerApp();

        let startIso, endIso;

        if (msg.startIso && msg.endIso) {
          startIso = msg.startIso;
          endIso = msg.endIso;
        } else {
          const secondsDefault = await getOptionNumber(
            LOG_WINDOW_SECONDS_KEY,
            120,
          );
          const seconds = Math.max(
            10,
            Math.floor(msg.seconds || secondsDefault),
          );
          endIso = new Date().toISOString();
          startIso = new Date(Date.now() - seconds * 1000).toISOString();
        }

        const res = await queryLogs({
          name: ql.name,
          classPath: ql.classPath,
          entriesPerPage: 300,
          descendingOrder: true,
          startIso,
          endIso,
          clientIpAddress: clientIp,
        });

        const entries = res.response?.entries || [];
        const items = aggregateBlocked(entries);

        sendResponse({ ok: true, items });
        return;
      }

      // ===== Geblockte Einträge für eine spezifische Domain abrufen =====
      if (msg.action === "blockedForDomain") {
        const domain = normalizeDomain(msg.domain);
        if (!domain) {
          sendResponse({ ok: true, item: null });
          return;
        }

        const item = await findBlockedForDomain(domain, {
          startIso: msg.startIso,
          endIso: msg.endIso,
          seconds: msg.seconds,
        });

        sendResponse({ ok: true, item });
        return;
      }

      // ===== Domain dauerhaft erlauben =====
      if (msg.action === "allowDomain") {
        const domain = normalizeDomain(msg.domain);
        if (!domain) {
          sendResponse({ error: "Ungültige Domain" });
          return;
        }

        await allowZone(domain);
        try {
          await deleteCachedZone(domain);
        } catch (_) {}

        sendResponse({ ok: true });
        return;
      }

      // ===== Dauerhafte Freigabe entfernen =====
      if (msg.action === "removeAllowDomain") {
        const domain = normalizeDomain(msg.domain);
        if (!domain) {
          sendResponse({ error: "Ungültige Domain" });
          return;
        }

        await deleteAllowedZone(domain);
        try {
          await deleteCachedZone(domain);
        } catch (_) {}

        sendResponse({ ok: true });
        return;
      }

      // ===== Domain temporär erlauben =====
      if (msg.action === "tempAllowDomain") {
        const domain = normalizeDomain(msg.domain);
        if (!domain) {
          sendResponse({ error: "Ungültige Domain" });
          return;
        }

        const minutesDefault = await getOptionNumber(
          TEMP_ALLOW_MINUTES_KEY,
          30,
        );
        const minutes = Math.max(1, Math.floor(msg.minutes || minutesDefault));

        await allowZone(domain);
        try {
          await deleteCachedZone(domain);
        } catch (_) {}

        const expiresTs = Date.now() + minutes * 60 * 1000;

        const state = await getTempAllowState();
        state[domain] = expiresTs;
        await setTempAllowState(state);

        const alarmName = `${TEMP_ALLOW_PREFIX}${domain}`;
        await chrome.alarms.clear(alarmName);
        await chrome.alarms.create(alarmName, { when: expiresTs });

        sendResponse({ ok: true, expiresTs });
        return;
      }

      // ===== Batch-Prüfung des Allow-Status =====
      if (msg.action === "allowedStatusBatch") {
        const domains = Array.isArray(msg.domains) ? msg.domains : [];
        const res = await allowedStatusBatch(domains);
        sendResponse({ ok: true, ...res });
        return;
      }

      sendResponse({ error: "Unbekannte Aktion" });
    } catch (e) {
      sendResponse({ error: e.message || "Fehler" });
    }
  })();

  return true;
});
