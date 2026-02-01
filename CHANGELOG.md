# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog**, and this project follows **Semantic Versioning** where possible.

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
