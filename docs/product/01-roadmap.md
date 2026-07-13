# Roadmap

Status: Active
Owner: 0disoft

## Current Position

The MVP phases are implemented and the latest verified public release is `0.5.14`. SCG is a
read-only compiler and linter with a published npm CLI, a GitHub Action, deterministic JSON/DOT/HTML
reports, explicit ZDP v2 adaptation, and repository-local plus central-catalog adoption evidence.

## Delivered

### Catalog Contract And Architecture

- `scg.service/v1alpha1`, `scg.catalog/v1alpha1`, and `scg.config/v1alpha1` contracts.
- Explicit owner, runtime, repository, deploy, data, review, and dependency fields.
- Stable diagnostic categories, exit-code meanings, generated-artifact policy, and report security
  boundary.
- Single public pnpm workspace with schema, core, CLI, report, and Action package boundaries.

### Compiler And Linter

- Multi-root manifest discovery with default excludes and bounded concurrency.
- Safe YAML parsing, normalization, dependency resolution, graph construction, deterministic
  ordering, redaction, path containment, and symlink handling.
- `scan`, `check`, and `report` commands with human and JSON output.
- Explicit `zdp-v2` adapter that preserves source-specific fields under `extensions.zdp` without
  moving ZDP policy into SCG.

### Reports And Automation

- Deterministic `catalog.json`, `graph.dot`, and static `report.html` output.
- GitHub Action check/report wrapper using the same CLI and core behavior.
- npm Trusted Publishing, GitHub Releases, immutable version tags, and moving major Action tags.
- Packed-package, installed-CLI, Action self-smoke, release recovery, secret, dependency, and
  repository-contract validation.
- Full-SHA workflow pins, CodeQL, bounded Dependabot updates, and explicit runner timeouts.

## Pre-1.0 Work

### Compatibility Review

- Keep the published 1.0 contract matrix synchronized with manifest, config, CLI JSON, diagnostic,
  exit-code, report, package, and Action surfaces.
- Resolve the remaining experimental alpha-schema and resource-default decisions before the 1.0
  release candidate.
- Maintain the pre-1.0-to-1.0 migration guide, removal rules, and deprecation window.
- Decide whether `check` and `report` require a configurable minimum service count while preserving
  intentional empty-repository validation.
- Define explicit per-source adapter configuration without schema autodetection, including overlap
  and precedence errors.

### Resource And Publication Safety

- Keep measured aggregate input, extension, depth, collection, and generated-report budgets aligned
  with the 1,000-service synthetic fixture and released consumer evidence.
- Keep the delivered directory-generation report protocol, writer exclusion, rollback tests, and
  fail-closed lock recovery contract under a merge-blocking Ubuntu and Windows runner matrix.
- Document the supported filesystem threat model and residual directory-replacement race where the
  Node runtime cannot provide descriptor-relative no-follow writes.

### Adoption Evidence

- Keep repository-local ZDP gates and the central 40-service catalog green against released Action
  bundles.
- Keep the standalone non-ZDP synthetic consumer fixture green through source, packed npm CLI, and
  GitHub Action execution before freezing the native `scg-v1` contract.
- Record Windows and Linux installed-package evidence for each release candidate.

### Release Confidence

- Keep hosted CodeQL, bounded dependency maintenance, npm visibility checks, and run-owned rollback
  guards green for each release candidate.
- Prove both existing-major-tag update and new-major-tag creation paths without rewriting immutable
  version tags.
- Keep ambiguous npm publish outcomes in forward-fix mode unless registry absence is positively
  established.

## 1.0 Exit Criteria

- Manifest and config schemas have documented compatibility and migration rules.
- CLI JSON, diagnostics, and exit codes have explicit stable-field guarantees.
- Action inputs, outputs, permissions, runtime, and tag policy are frozen.
- Native and ZDP adapter consumers pass released-package and released-Action smoke tests.
- No open critical/high security alert or unresolved release-provenance blocker exists.
- `pnpm run check`, CodeQL, package smoke, Action smoke, and release dry-run evidence are green at the
  exact release commit.

## Explicitly Deferred

- Hosted portal, RBAC, live inventory database, Kubernetes discovery, cloud cost ingestion, incident
  workflow, automatic ownership sync, source-code dependency inference, and telemetry backend.
