# <img src="icons/icon48.png" alt="Technitium Adblock Control" width="28" /> Technitium Adblock Control

Deutsch: [docs/README.de.md](docs/README.de.md)

> A powerful browser extension for Chrome & Vivaldi to control the blocking feature of the [Technitium DNS Server](https://technitium.com/dns/).

![Version](https://img.shields.io/badge/version-0.3.1-blue.svg) ![Manifest](https://img.shields.io/badge/manifest-V3-success.svg) ![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

**Technitium Adblock Control (TAC)** connects your browser live to your Technitium DNS server. It lets you control DNS blocking globally, inspect query logs in real time, and allow blocked domains in the context of the currently open webpage.

---

## ✨ Features

* **⚡ Live status & control:** Toggle DNS blocking with one click.
* **⏱️ Temporary disable:** Pause blocking for X minutes (timer-based).
* **🎯 Context awareness:** Shows which blocked domains belong to the *currently open* page (matching browser resource hostnames ↔ Technitium DNS query logs).
* **🏷️ Resource-type badges:** Optional tags like **IMG / JS / CSS / XHR / FONT / FRAME / MEDIA** indicate what kind of elements a domain is used for (derived from `performance.getEntriesByType('resource')`).
* **🔓 Granular allow rules:**
  * **Allow:** Permanently add a domain to the allowlist.
  * **Temp Allow:** Allow a domain only for a configurable time (e.g., 30 minutes).
* **🕵️‍♂️ Automatic client detection:** Determines the browser’s client IP by using a DNS-log trick (works even with dynamic IPs).
* **🌍 Multilingual UI:** Uses your system/browser language by default (German/English). You can override the UI language in **Options**.
* **🎨 Themes:** Follows your system theme by default. You can force **Light / Gray / Dark** in **Options**.

## 📸 Screenshots

| Popup overview | Settings |
|:---:|:---:|
| ![Popup](docs/popup_screenshot.png) | ![Options](docs/options_screenshot.png) |

---

## 🛠️ Installation (Developer Mode)

First, install Query Logs (Sqlite) from the Technitium Appstore. Click on Apps > Appstore and search for Query Logs (Sqlite). Click install.

As the extension is not yet available in the Chrome Web Store, it must be installed manually:

1. Clone this repository or download it as a ZIP and extract it.
2. Open your browser (Chrome, Vivaldi, Edge, Brave).
3. Go to `chrome://extensions`.
4. Enable **Developer mode** (top right).
5. Click **"Load unpacked"**.
6. Select the folder containing `manifest.json`.

## ⚙️ Configuration

After installing, connect the extension to your Technitium server:

1. Right-click the extension icon → **Options**.
2. **Base URL:** The URL of your Technitium web panel (e.g., `http://192.168.1.10:5380`).
3. **API Token:**
   * In the Technitium web panel, click on your Username → `Create API Token`.
   * Create a token/user with sufficient permissions for settings, logs, and allowlist.
4. Click **Save**.

---

## ✅ Requirements / Notes

* **Query logging must be enabled** (Query Logger DNS App / SQLite query logs).
* Your client must **use Technitium as DNS**, otherwise no matching log entries will appear.
* **DNS caching** can reduce fresh log hits. If the popup looks empty, try a hard reload of the page.

---

## 🧠 How it works (Technical Deep Dive)

### 1) The “Magic IP” trick
Browser extensions don’t always know which client IP they appear as on the DNS server (VPN/NAT/etc.).

* The extension triggers a DNS lookup for a unique hostname (e.g., `ttip-<timestamp>-<random>.example.com`).
* It then searches the Technitium query logs for that hostname.
* The detected `clientIpAddress` is cached and used to filter logs for **your** device.

### 2) Resource matching
To show what was blocked **on this page**, TAC reads the hostnames of loaded resources via:

* `performance.getEntriesByType('resource')`

It then matches those hostnames against domains found in Technitium’s **Blocked** query logs (exact match or subdomain match).

### 3) Resource-type badges
Each `PerformanceResourceTiming` entry includes an `initiatorType` (e.g., `img`, `script`, `css`, `xmlhttprequest`). TAC aggregates these per domain and shows compact tags like `IMG`, `JS`, `CSS`.

> Note: If a resource is blocked so early that the browser doesn’t create a timing entry, a type badge may be missing for that domain.

## 🔒 Privacy & Security

**What data does the extension process?**

- The extension reads, in the active tab, only **hostnames of network resources** via the Web Performance API (`performance.getEntriesByType('resource')`).
- Page content (DOM text, form data, cookies, etc.) is **not** read.
- In addition, the extension queries **DNS query logs** from your own Technitium server via the Technitium DNS HTTP API to display blocked domains.

**Where is data stored?**

- Configuration (Technitium base URL, API token, UI settings, timer state, temp‑allow rules) is stored only locally in the browser’s `chrome.storage.local`.
- **No data** is sent to third parties or external services – only to the Technitium DNS server you configured.

**Permissions & access to websites**

- The extension **requires access to all websites in order to read the hostnames of loaded resources and match them with the DNS block logs of your Technitium server. No page contents are read.**
- This access is used exclusively to:
  - correlate currently loaded domains/resources with Technitium query logs (“Blocked on this page”),
  - show the status of blocked/allowed domains in the context of the currently opened page.

**Handling of API tokens**

- The API token for your Technitium server is stored only locally in the browser and is used exclusively for calls to the Technitium DNS HTTP API.
- It is recommended to use a **dedicated API token** with permissions limited to what is necessary (settings/logs/allowlist), instead of a general admin token.

---

## 🏗️ Tech Stack

* **Manifest V3** service worker architecture
* **Vanilla JS**
* **Technitium DNS HTTP API**
* **Chrome Scripting & Storage API**

## 📝 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the `LICENSE` file for details.

---

**Disclaimer:** This is an unofficial project and is not affiliated with Technitium.
