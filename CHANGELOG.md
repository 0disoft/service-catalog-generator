# Changelog

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
