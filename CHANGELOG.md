# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog**, and this project follows **Semantic Versioning** where possible.

## [0.3.2] - 2024-05-21
### Changed
- The "Show Allow Status" feature is now permanently enabled to improve user experience. The corresponding option has been removed from the settings page.
- All source code comments have been translated to German to improve maintainability.

## [0.3.1] - 2026-03-02
### Fixed
- Blocked main domains (including NxDomain cases) now reliably appear in the popup, even when the browser shows an internal error page instead of the original site.

### Changed
- Improved blocked-entry detection in the background service worker:
  - A log entry is considered blocked if its `responseType` indicates a blocked response (e.g. `Blocked`, `CacheBlocked`, `UpstreamBlocked`) or if the DNS `RCODE` corresponds to `NxDomain`.
- The global blocked list (`blockedList` action) once again filters by the current client IP address (based on the “Magic IP” trick), so only queries from the active client are shown in multi-client setups.
- The domain-specific fallback query (`blockedForDomain` action) intentionally does **not** filter by client IP to robustly catch blocked/NxDomain entries for the active tab’s domain, even in environments where the logged client IP does not exactly match the detected one.
- The popup now falls back to the tab URL’s hostname when a performance snapshot cannot be created (e.g. on error pages), ensuring correct domain matching for blocked main domains.

## [0.3.0] - 2026-02-01
### Added
- Theme toggle button in the popup (top-right) to quickly switch themes.
- New **Grey** theme in addition to Light/Dark/Auto.
- Resource-type badges next to blocked domains (derived from `performance.getEntriesByType("resource")` / `initiatorType`), e.g. IMG/JS/CSS/FONT/XHR/FRAME/MEDIA.
- Toolbar-style compact top controls (status + enable/disable + temporary disable) to reduce vertical space.

### Changed
- Theme toggle icon now shows the **next** theme in the cycle:
  - Light → shows 🌙 (Grey next)
  - Grey → shows ✦ (Dark next)
  - Dark → shows ☀ (Light next)
- Improved visibility of the theme toggle in Light mode (better contrast).
- Popup header now includes the extension icon next to “Technitium Adblock Control”.
- Minutes input field is compact (3-digit width) for a cleaner toolbar layout.
- Removed the extra hint text “Temporarily disable (1–1440 minutes)” to slim down the UI.

## [0.2.1] - 2026-02-01
### Added
- Multilingual UI (German/English) with automatic system language detection and manual override in Options.
- Popup: live view of blocked domains in the context of the currently open page (resource hostnames ↔ DNS query logs).
- Global blocking toggle + temporary disable with timer.
- Allow / Temp Allow actions for domains (including remove allow when applicable).
- Automatic client IP detection via DNS-log trick to filter relevant query log entries.
