# Changelog

## Unreleased

- Pinned third-party CI and release Actions to immutable commit SHAs and disabled checkout
  credential persistence.
- Moved mutable major Action tag promotion and rollback to the GitHub Git Refs API so release jobs
  do not depend on persisted Git credentials.
- Added scheduled and change-triggered CodeQL analysis for JavaScript/TypeScript source and GitHub
  Actions workflows.
- Guarded release rollback with a run-local creation receipt so preflight failures cannot delete a
  pre-existing GitHub Release.
- Guarded major Action tag rollback with a run-local change receipt so failures before tag movement
  cannot alter external tag state.
- Added npm version preflight and retry-based post-publish visibility checks so an ambiguous publish
  result cannot roll back GitHub state for an immutable package that may already exist.
- Added bounded weekly Dependabot updates for npm and GitHub Actions, plus explicit timeouts for all
  hosted workflow jobs.
- Replaced public contribution, development, ownership, issue, and pull-request scaffold text with
  project-specific setup, validation, security, compatibility, and maintainer contracts.
- Expanded secret scanning to untracked non-ignored files and made tracked working-tree deletions
  safe to validate before staging.
- Rebased the product roadmap and specification on the shipped `0.5.11` surface and made remaining
  pre-1.0 compatibility, adoption, migration, and hosted-release evidence explicit.

## 0.5.11

- Rebuilt and committed the CLI and GitHub Action bundles so Action catalog metadata reports the
  release version instead of the stale `0.5.9` runtime version.
- Added a release contract test that keeps the committed Action bundle version aligned with
  `package.json`.

## 0.5.10

- Added GitHub Action self-smoke coverage for nested-root ZDP v2 manifests and fail-on-warning
  behavior.
- Documented the boundary between repository-local ZDP checks, central dependency graph builds,
  and `zdp-architecture-linter` policy validation.

## 0.5.9

- Classified unrecognized schema validation issues as `manifest.invalid` instead of reporting them
  as missing required fields.
- Added a `0.5.8` config migration note for removed no-op deterministic and review-date settings.

## 0.5.8

- Updated the operational contract with verified `0.5.8` release evidence.

- Moved npm publish to the final release step and added GitHub Release / major Action tag recovery
  when release automation fails before publish completes.
- Parsed manifests with bounded concurrency while preserving deterministic catalog ordering.
- Removed no-op `requireLastReviewedAt`, `output.deterministic`, and `--deterministic` contracts.

## 0.5.7

- Fixed GitHub Action summary parsing so missing or malformed CLI JSON no longer produces fabricated
  zero-count outputs.
- Normalized redacted `repository.provider: url` records to `provider: unknown` after removing the
  URL value.
- Added regression coverage for repeated secret-like manifest values.
- Added the explicit `zdp-v2` input schema adapter for ZDP service manifests.
- Updated the operational contract with verified `0.5.6` release evidence.
- Added a peak RSS performance test for the 1,000-manifest memory budget.
- Added retry coverage for transient dependency audit registry failures.

## 0.5.6

- Added duplicate service id diagnostics to prevent silent catalog key collisions.
- Fixed nested discovery exclude globs so `services/legacy/**` no longer drops sibling service
  manifests.
- Fixed Linux npm bin symlink entrypoint detection for packed CLI installs.
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
