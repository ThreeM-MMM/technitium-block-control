# <img src="icons/icon48.png" alt="Technitium Adblock Control" width="28" /> Technitium Adblock Control

Deutsch: [docs/README.de.md](docs/README.de.md)

> A powerful browser extension for Chrome & Vivaldi to control the blocking feature of the [Technitium DNS Server](https://technitium.com/dns/).

![Version](https://img.shields.io/badge/version-0.3.0-blue.svg) ![Manifest](https://img.shields.io/badge/manifest-V3-success.svg) ![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

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
