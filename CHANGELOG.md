# Changelog

## Unreleased

- Added the explicit `zdp-v2` input schema adapter for ZDP service manifests.
- Updated the operational contract with verified `0.5.3` release evidence.
- Added a peak RSS performance test for the 1,000-manifest memory budget.
- Added retry coverage for transient dependency audit registry failures.

## 0.5.5

- Added duplicate service id diagnostics to prevent silent catalog key collisions.
- Fixed nested discovery exclude globs so `services/legacy/**` no longer drops sibling service
  manifests.
- Hardened review date validation, future-date diagnostics, and snapshot summary consistency.
- Applied repository URL redaction before JSON, DOT, and HTML report generation.
- Rejected symlinked report output directories that resolve outside the workspace.
- Serialized release jobs across tags and added packed tarball install smoke before npm publish.

## 0.5.3

- Added a tracked-file secret scanner to the standard `check` gate.
- Added a dependency audit gate to the standard `check` command.
- Added implementation coverage for human-readable CLI diagnostic formatting.
- Added implementation coverage that environment variables cannot change validation policy.
- Added a core performance test for the 500-manifest hosted-runner scan budget.
- Updated operational release docs with verified package, GitHub Release, and Action tag
  evidence.
- Added a public security policy for vulnerability reporting and supported versions.

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
