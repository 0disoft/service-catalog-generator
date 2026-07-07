# Changelog

## Unreleased

- Added a tracked-file secret scanner to the standard `check` gate.
- Added a dependency audit gate to the standard `check` command.
- Added implementation coverage for human-readable CLI diagnostic formatting.
- Added implementation coverage that environment variables cannot change validation policy.
- Added a core performance test for the 500-manifest hosted-runner scan budget.

## 0.5.2

- Normalized the published `scg` bin path to match npm package metadata rules.

## 0.5.1

- Switched the release workflow to npm Trusted Publishing through GitHub OIDC.
- Removed npm token secret usage from release validation and operational docs.

## 0.5.0

- Added `scg.service/v1alpha1`, `scg.catalog/v1alpha1`, and `scg.config/v1alpha1` schemas.
- Added `scan`, `check`, and `report` CLI commands with deterministic JSON diagnostics and exit codes.
- Added static JSON, DOT, and HTML report generation.
- Added a GitHub Action wrapper that delegates to the CLI and exposes summary outputs.
- Added CI, Action self-smoke, release preflight, and tag-triggered Trusted Publishing workflow.
- Hardened generated report escaping, output path handling, package metadata checks, and version drift checks.
