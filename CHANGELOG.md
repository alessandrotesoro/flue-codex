# Changelog

## Unreleased

- Breaking: Narrowed the root export to provider registration, safe provider types, and shared errors.
- Breaking: Moved provider-definition creation to `@sematico/flue-codex/provider`.
- Breaking: Moved diagnostics, auth, runtime, and model APIs behind explicit subpath exports.
- Breaking: Replaced flat provider and diagnostics options with grouped option objects.
- Breaking: Provider registration results now expose Flue-ready `defaultModelId` and `modelIds`.

## 0.1.2 - 2026-06-29

- New: Added CI for pushes, pull requests, and manual runs.
- Tweak: Publish releases from verified tags only.
- Tweak: Infer Codex OAuth and runtime metadata locally.
- Fix: Validate OAuth token endpoints before refresh.
- Fix: Pass `CODEX_HOME` into Codex subprocesses.
- Fix: Increase `codex doctor` discovery timeout.
- Fix: Recover credentials after concurrent auth refreshes.

## 0.1.1 - 2026-06-27

- Tweak: Bumped package version to `0.1.1`.

## 0.1.0 - 2026-06-27

- New: Initial `@sematico/flue-codex` package.
