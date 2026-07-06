# Roadmap

Status: Draft
Owner: 0disoft

## Purpose

This roadmap keeps the first releases small enough to ship while preserving the path toward richer
catalog reports.

## Phase 0: Catalog Contract

- Accept the read-only `service.yaml` compiler and linter boundary.
- Define `service.yaml` v1alpha1 fields.
- Include example manifests for a tiny multi-service workspace.
- Define required, optional, and explicitly out-of-scope fields.
- Record how owner, runtime, repository, deploy target, data class, and dependencies are expressed.
- Record diagnostics, exit codes, generated artifact policy, and static report security rules.

## Phase 1: Repository Skeleton

- Create a single pnpm workspace.
- Add packages for schema, core, CLI, report, and action.
- Add root TypeScript, test, format, lint, CI, and release placeholders.
- Keep unimplemented scripts honest: they must fail clearly or run real checks.

## Phase 2: Schema and Fixtures

- Implement `scg.service/v1alpha1`, `scg.catalog/v1alpha1`, and `scg.config/v1alpha1` schemas.
- Add valid minimal, valid full, missing owner, unknown dependency, secret-like value, and bad schema
  version fixtures.
- Make fixture tests the first contract gate.

## Phase 3: Core Engine

- Discover manifests below configured roots.
- Exclude `.git`, `node_modules`, `dist`, `coverage`, and output directories by default.
- Parse YAML safely, normalize records, validate manifests, resolve dependencies, and build graph
  edges.
- Enforce path, symlink, redaction, and deterministic ordering policies.

## Phase 4: CLI MVP

- Scan one folder or a list of folders.
- Validate manifest shape and required fields.
- Print diagnostics suitable for humans.
- Export normalized catalog JSON.
- Export dependency graph DOT.
- Preserve stable exit codes and JSON output.

## Phase 5: Static Report

- Generate a static HTML report from the same normalized catalog.
- Show service list, missing metadata, owner/runtime/deploy slices, and dependency graph.
- Keep report generation deterministic for CI diffs.
- Escape manifest strings for HTML and DOT output.

## Phase 6: CI Wrapper

- Provide a GitHub Action wrapper around the CLI.
- Support check-only validation and optional report artifact upload.
- Keep default permissions read-only.
- Use root `action.yml` and propagate CLI exit behavior.

## Phase 7: Release

- Release npm package `@0disoft/service-catalog-generator` and CLI binary `scg`.
- Use npm trusted publishing when repository and package metadata are ready.
- Publish GitHub Releases and Action tags from the same version stream.
- Treat pre-1.0 schema and JSON-output breaks as allowed only with migration notes.

## 1.0 Freeze

- Freeze manifest schema compatibility.
- Freeze CLI JSON output compatibility.
- Freeze documented exit code meanings.
- Require migration notes for any later breaking change.

## Explicitly Deferred

- Hosted portal, RBAC, live inventory database, Kubernetes discovery, cloud cost ingestion, incident
  workflow, and automatic ownership sync.
