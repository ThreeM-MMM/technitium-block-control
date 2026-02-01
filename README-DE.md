# 🛡️ Technitium Adblock Control

> Eine leistungsstarke Browser-Extension für Chrome & Vivaldi zur direkten Steuerung der Block-Funktion des [Technitium DNS Servers](https://technitium.com/dns/).

![Version](https://img.shields.io/badge/version-0.2.1-blue.svg) ![Manifest](https://img.shields.io/badge/manifest-V3-success.svg) ![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

**Technitium Adblock Control (TAC)** verbindet deinen Browser live mit deinem Technitium DNS-Server. TAC ermöglicht es dir, Adblocking global zu steuern, Logs in Echtzeit einzusehen und geblockte Domains kontextbezogen zur aktuell geöffneten Webseite freizugeben oder die Freigabe wieder zu entfernen.

---

## ✨ Features

* **⚡ Live-Status & Steuerung:** DNS-Blocking mit einem Klick an-/ausschalten.
* **⏱️ Temporäres Deaktivieren:** Blocking für X Minuten pausieren.
* **🎯 Kontext-Awareness:** Erkennt automatisch, welche geblockten Domains zur *aktuell* geöffneten Webseite gehören (Subdomain-Matching zwischen Browser-Ressourcen und DNS-Logs).
* **🔓 Granulare Freigaben:**
  * **Allow:** Domain dauerhaft auf die Whitelist setzen.
  * **Temp Allow:** Domain nur für eine definierte Zeit (z.B. 30 Min) erlauben.
* **🕵️‍♂️ Automatische Client-Erkennung:** Ermittelt automatisch die korrekte IP-Adresse des Browsers im Netzwerk, um nur relevante Logs anzuzeigen (selbst bei dynamischen IPs).
* **🚀 Performance:** Caching für Client-IP & Query-Logger-Erkennung sowie effiziente API-Calls im Hintergrund (Allow-Status optional per Batch-Check).

## 📸 Screenshots

| Popup Übersicht | Einstellungen |
|:---:|:---:|
| ![Popup](docs/popup_screenshot.png) | ![Options](docs/options_screenshot.png) |

---

## 🛠️ Installation (Entwicklermodus)

Da die Extension noch nicht im Chrome Web Store verfügbar ist, muss sie manuell installiert werden:

1. Klone dieses Repository oder lade es als ZIP herunter und entpacke das Archiv.
2. Öffne deinen Browser (Chrome, Vivaldi, Edge, Brave).
3. Gehe zu `chrome://extensions`.
4. Aktiviere oben rechts den **Entwicklermodus**.
5. Klicke auf **"Entpackte Erweiterung laden"**.
6. Wähle den Ordner aus, in dem die `manifest.json` liegt.

## ⚙️ Konfiguration

Nach der Installation muss die Extension mit deinem Technitium Server verbunden werden:

1. Klicke mit der rechten Maustaste auf das Extension-Icon -> **Optionen**.
2. **Basis-URL:** Die URL deines Technitium Web-Panels (z.B. `http://192.168.1.10:5380`).
3. **API Token:** API Token aus Technitium hinterlegen. Tipp:
   * Gehe in dein Technitium Web-Panel.
   * Navigiere zu `Settings` > `Web Service`.
   * Erstelle einen neuen Token oder User für die API.
4. Speichern klicken.

---

## ✅ Voraussetzungen / Hinweise

* **Query Logging muss aktiv sein** (Query Logger DNS App).
* Dein Client muss **Technitium als DNS** nutzen, sonst erscheinen keine passenden Log-Einträge.
* **DNS-Cache** kann dazu führen, dass kurzfristig keine neuen Log-Treffer entstehen (bei Bedarf Seite hart neu laden).

---

## 🧠 Wie es funktioniert (Technical Deep Dive)

Diese Extension nutzt einige Kniffe, um die Limitierungen einer Browser-Umgebung zu umgehen:

### 1. Richtige IP
Da eine Browser-Extension keinen Zugriff auf die Netzwerk-Infrastruktur hat, weiß sie oft nicht, unter welcher IP sie beim DNS-Server auftritt (z.B. wegen VPNs oder NAT).

* **Lösung:** Die Extension sendet im Hintergrund einen "Fake-Request" an eine einzigartige Domain (z.B. `ttip-12345.example.com`).
* Anschließend durchsucht sie sofort die DNS-Logs nach genau dieser Anfrage.
* Die Client-IP aus diesem Log-Eintrag wird als die "eigene" IP gespeichert und für alle weiteren Filter genutzt.

### 2. Resource Matching
Um anzuzeigen, was "auf dieser Seite" geblockt wurde, nutzt die Extension die `performance.getEntriesByType("resource")` API.

* Sie vergleicht die Hostnames aller geladenen Ressourcen der aktuellen Tab-Session mit den `Blocked`-Logs des DNS-Servers.
* Matching erfolgt per Subdomain-Regel (exakt oder als Subdomain), um Seitenbezug zuverlässig herzustellen.

---

## 🏗️ Tech Stack

* **Manifest V3** Service Worker Architektur.
* **Vanilla JS**
* **Technitium DNS HTTP API**
* **Chrome Scripting & Storage API**

## 📝 Lizenz

Dieses Projekt ist unter der **GNU General Public License v3.0 (GPLv3)** lizenziert. Siehe `LICENSE` Datei für Details.

---

**Disclaimer:** Dies ist ein inoffizielles Projekt und steht in keiner Verbindung zu Technitium.
