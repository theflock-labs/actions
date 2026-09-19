# Changelog

## 0.2.0 — 2026-09-20

- Add bounded `evaluate` execution and offline `score` commands with versioned suite/result schemas.
- Preserve provenance, missing cases, failed-case costs and incomplete billing in evaluation reports.
- Add 36 explicitly synthetic cases and reproducible deterministic baselines for issue triage, CI diagnosis and release-note constraints.
- Add a manual live-evaluation workflow and a consent-based design-partner validation protocol.
- Fix structural JSON redaction so numeric secret coincidences cannot corrupt model feedback or receipt metering.
- Expand the deterministic test suite to 87 tests.

Live model comparisons, representative production outcomes and commercial defensibility remain unproven. The included synthetic baselines measure only their declared assertions.

## 0.1.1 — 2026-09-20

- Block additional common credential paths in built-in file tools.
- Reject Windows alternate-stream syntax and trailing dot/space path aliases on all platforms.
- Protect workflow and task directories regardless of filesystem case sensitivity.
- Add seven path-boundary regression cases; the deterministic suite now contains 65 tests.
- Derive the MCP client version from the package version.

The preview limitations and live-validation status from 0.1.0 still apply.

## 0.1.0 — 2026-09-20

First public preview of Flock Actions.

- Bundled GitHub Action, local CLI and shared library on Node 24.
- Trusted task contracts with strict configuration and argument schemas.
- OpenAI, Anthropic and OpenAI-compatible protocol adapters.
- Scoped files, fixed command adapters, HTTPS tools and allowlisted MCP stdio/Streamable HTTP.
- Bounded agent loops, independent verification, repair feedback and redacted receipts.
- Explicit promotion of verified traces to reviewed exact-input runbooks with prerequisite guards and zero inference.
- Incomplete provider billing explicitly distinguished from a complete cost estimate.
- 58 deterministic tests and successful Linux/macOS/Windows CI, including real local MCP servers and packaged Action execution.
- Market, defensibility, monetization, integration and security documentation.

Live provider acceptance is pending a configured account secret. No managed service, enterprise certification, general autonomous-shell sandbox, parameterized runbook promotion, or commercial moat is claimed by this preview.
