// background/technitiumApi.js
// Dieses Modul kapselt alle API-Anfragen an den Technitium DNS Server.

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["baseUrl", "apiKey"], (data) => resolve(data));
  });
}

async function technitiumRequest(path) {
  const { baseUrl, apiKey } = await getConfig();

  if (!baseUrl || !apiKey) {
    throw new Error("Technitium nicht konfiguriert");
  }

  const cleanBaseUrl = String(baseUrl).replace(/\/$/, "");
  const hasQuery = path.includes("?");
  const url = `${cleanBaseUrl}/api${path}${hasQuery ? "&" : "?"}token=${encodeURIComponent(apiKey)}`;

  let response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (err) {
    throw new Error("Technitium API nicht erreichbar");
  }

  if (!response.ok) {
    throw new Error(`API HTTP Fehler (${response.status})`);
  }

  const data = await response.json();

  if (data.status && data.status !== "ok") {
    // Technitium liefert z.B. { status: "error", errorMessage: "..."}
    throw new Error(data.errorMessage || "Technitium API Fehler");
  }

  return data;
}

// ===== Einstellungen / Blockier-Status =====

// Ruft die allgemeinen DNS-Einstellungen ab.
// GET /api/settings/get?token=...
export async function getDnsSettings() {
  return technitiumRequest(`/settings/get`);
}

// Aktiviert oder deaktiviert das Ad-Blocking.
// Setzt `enableBlocking` über den `settings/set`-Endpunkt.
export async function setEnableBlocking(enable) {
  // /api/settings/set?enableBlocking=true|false
  return technitiumRequest(
    `/settings/set?enableBlocking=${enable ? "true" : "false"}`,
  );
}

// Deaktiviert das Blocking für eine bestimmte Anzahl von Minuten.
// GET /api/settings/temporaryDisableBlocking?minutes=5
export async function temporaryDisableBlocking(minutes) {
  const m = Math.max(1, Math.floor(minutes || 5));
  return technitiumRequest(`/settings/temporaryDisableBlocking?minutes=${m}`);
}

// ===== DNS-Apps =====

// Listet alle installierten DNS-Apps auf.
// GET /api/apps/list
export async function listApps() {
  return technitiumRequest(`/apps/list`);
}

// ===== Protokolle (Query Logs) =====
// WICHTIG: Der Endpunkt für Query Logs ist `/api/logs/query`, nicht `/api/apps/*`.
export async function queryLogs(params) {
  const {
    name,
    classPath,
    pageNumber = 1,
    entriesPerPage = 50,
    descendingOrder = true,
    startIso,
    endIso,
    clientIpAddress,
    responseType,
    qname,
  } = params || {};

  const qs = new URLSearchParams();
  if (name) qs.set("name", name);
  if (classPath) qs.set("classPath", classPath);
  qs.set("pageNumber", String(pageNumber));
  qs.set("entriesPerPage", String(entriesPerPage));
  qs.set("descendingOrder", descendingOrder ? "true" : "false");
  if (startIso) qs.set("start", startIso);
  if (endIso) qs.set("end", endIso);
  if (clientIpAddress) qs.set("clientIpAddress", clientIpAddress);
  if (responseType) qs.set("responseType", responseType);
  if (qname) qs.set("qname", qname);

  return technitiumRequest(`/logs/query?${qs.toString()}`);
}

// ===== Erlaubte Zonen (Allowed Zones) =====

// Fügt eine Domain zur Allow-Liste hinzu.
// GET /api/allowed/add?domain=...
export async function allowZone(domain) {
  return technitiumRequest(`/allowed/add?domain=${encodeURIComponent(domain)}`);
}

// Entfernt eine Domain von der Allow-Liste.
// GET /api/allowed/delete?domain=...
export async function deleteAllowedZone(domain) {
  return technitiumRequest(
    `/allowed/delete?domain=${encodeURIComponent(domain)}`,
  );
}

// Listet die Einträge in den erlaubten Zonen auf.
// GET /api/allowed/list?domain=...
export async function listAllowed(domain) {
  const d = domain ? encodeURIComponent(domain) : "";
  return technitiumRequest(`/allowed/list?domain=${d}`);
}

// ===== Cache =====

// Löscht eine Domain aus dem DNS-Cache.
// GET /api/cache/delete?domain=...
export async function deleteCachedZone(domain) {
  return technitiumRequest(
    `/cache/delete?domain=${encodeURIComponent(domain)}`,
  );
}
