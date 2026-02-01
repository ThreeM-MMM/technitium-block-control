# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog**, and this project follows **Semantic Versioning** where possible.

## [0.2.1] - 2026-02-01
### Added
- Multilingual UI (German/English) with automatic system language detection and manual override in Options.
- Popup: live view of blocked domains in the context of the currently open page (resource hostnames ↔ DNS query logs).
- Global blocking toggle + temporary disable with timer.
- Allow / Temp Allow actions for domains (including remove allow when applicable).
- Automatic client IP detection via DNS-log trick to filter relevant query log entries.