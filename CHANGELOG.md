# Changelog

## Unreleased

## 1.0.1

- Added a normal-registry OpenFeature local-provider consumer fixture that selects real SCG report
  formats and verifies the built CLI output through the repository conformance path.
- Made the complete check rebuild the committed Action bundle before contract validation so clean
  checkouts do not depend on stale generated output.
- Promoted the repository-owned OpenFeature consumer fixture from the final release candidate to
  the published stable `@0disoft/openfeature-local-provider@1.0.0` package.

## 1.0.0

- Promoted the verified v1 manifest, config, catalog, CLI, report, and Action contracts to stable
  npm `latest` and Action `v1` channels without narrowing the release-candidate compatibility
  guarantees.

## 1.0.0-rc.2

- Recorded the published `1.0.0-rc.1` npm, provenance, signature, prerelease, hosted smoke, and
  stable-channel isolation evidence.
- Removed Windows command-shell interpretation from installed-package smoke execution while keeping
  the generated npm shim presence check and direct packaged CLI validation.
- Added Ubuntu and Windows consumer smoke for the exact released Action tag, bound to the package
  version and shared canonical, legacy, and mixed conformance assertions.
- Rejected missing or malformed ZDP review dates instead of normalizing them to a stale sentinel,
  and bounded manifest reads without allocating the configured per-file limit up front.

## 1.0.0-rc.1

- Promoted native manifest, config, and catalog contracts to `scg.service/v1`, `scg.config/v1`, and
  `scg.catalog/v1`; pre-1.0 service and config ids remain accepted and normalize to v1 throughout
  the 1.x line.
- Added source, packed-package, registry, and hosted Action conformance coverage for legacy alpha
  service and config inputs alongside canonical v1 consumers.
- Replaced the placeholder migration validation with an executable alpha-to-v1 normalization and
  catalog-output compatibility gate.
- Froze the 1.0 resource defaults as compatibility floors and published the stable CLI, JSON,
  report, diagnostic, Action, and release-channel contract.
- Added prerelease-aware release validation: release candidates publish under npm `next`, create a
  GitHub prerelease, and never move stable Action major tags or npm `latest`.
- Added native Bash, Zsh, and PowerShell parsing and registration checks on pinned Ubuntu, macOS,
  and Windows hosted runners for generated completion scripts.
- Added a reusable native/mixed consumer conformance manifest and runner shared by source,
  packed-package, and released-package validation.
- Added a merge-blocking TypeScript 7 native compiler lane on Ubuntu and Windows while retaining
  TypeScript 6 for compiler API and package-build compatibility.

## 0.5.21

- Replaced quadratic source overlap checks with hierarchy sorting and added 5,000-declaration,
  100-root, and mixed 500/1,000-manifest performance contracts.
- Added Ubuntu and Windows source compatibility coverage for custom manifest names, global excludes,
  filesystem case behavior, junction aliases, and outside-workspace links.
- Bounded config reads at 1 MiB and rejected manifest-name paths that would otherwise produce silent
  empty catalogs.
- Added Bash, Zsh, and PowerShell completion generated from the same metadata as CLI help.
- Updated `@types/node`, Oxlint, and Oxfmt to current compatible patch/minor releases.

## 0.5.20

- Added field-specific, redacted `config.invalid` diagnostics for config schema failures across the
  CLI and GitHub Action.
- Extended exact published-package registry smoke to compile native and mixed adapter consumers on
  Ubuntu and Windows before release evidence verification.

## 0.5.19

- Added source-scoped `scg-v1` and `zdp-v2` adapters with fail-closed lexical and realpath ownership,
  aggregate catalog policy, cross-source dependencies, and explicit legacy-selector conflicts.
- Added a mixed synthetic consumer to source tests, packed-package smoke, and hosted Action smoke.

## 0.5.18

- Added optional `validation.minimumServiceCount` policy with a zero default, fail-closed normalized
  service counting, strict configuration bounds, and CLI plus GitHub Action coverage.

## 0.5.17

- Added post-release Ubuntu and Windows registry smoke automation for the exact published npm
  package, followed by provenance, signature, GitHub Release, and tag evidence verification.

## 0.5.16

- Resolved annotated GitHub release tags to their commit targets during release-evidence checks.
- Replaced ESLint, typescript-eslint, and Prettier with pinned Oxlint and Oxfmt quality gates while
  retaining TypeScript as the type-check, project-build, and declaration authority.

## 0.5.15

- Published JSON, DOT, and HTML reports as one owner-marked directory generation with writer
  exclusion, stale-format removal, promotion rollback, and fail-closed handling for unowned files
  and crash-retained locks.
- Added merge-blocking Ubuntu and Windows report publication tests for filesystem-specific staging,
  locking, promotion, and rollback behavior.
- Added configurable aggregate budgets for input bytes, manifest structure, retained extensions,
  and generated reports, with fail-closed diagnostics instead of partial catalog publication.
- Added a standalone native `scg-v1` consumer fixture exercised by source tests, the packed npm CLI,
  and the GitHub Action self-smoke workflow.
- Classified package, schema, CLI, report, diagnostic, and Action surfaces as stable, experimental,
  or internal and added the pre-1.0-to-1.0 migration policy.

## 0.5.14

- Rejected credential-bearing repository URLs, control characters and POSIX boundary escapes in
  report output paths, and GitHub output injection through multiline values.
- Excluded duplicate service IDs from normalized services and graphs, bounded duplicate diagnostics,
  and enforced catalog ID uniqueness.
- Preserved Action config precedence for omitted inputs and added explicit false boolean overrides.
- Bounded recursive glob matching and manifest reads against pathological patterns and file races.
- Preserved dependency direction and resolution in graph edges and separated typed DOT nodes.
- Kept complete snapshots in `report --json` while adding bounded `--summary-json` output for the
  GitHub Action.
- Enforced lifecycle/retirement consistency and committed Action bundle drift checks in CI and
  release workflows.

## 0.5.13

- Replaced polynomial stable-ID edge trimming with bounded string operations and added a repeated
  separator regression test for uncontrolled ZDP owner input.

## 0.5.12

- Made Action builds compile workspace packages before bundling and fail when the committed Action
  runtime version differs from the root package version.
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
- Extended release evidence to verify SLSA provenance package digest, workflow, tag, commit identity,
  and installed npm package signatures.

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
