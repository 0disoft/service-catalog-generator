# Roadmap

Status: Draft
Owner: 0disoft

## Purpose

This roadmap keeps the first releases small enough to ship while preserving the path toward richer
catalog reports.

## Phase 0: Catalog Contract

- Draft the minimal `service.yaml` fields.
- Include example manifests for a tiny multi-service workspace.
- Define required, optional, and explicitly out-of-scope fields.
- Record how owner, runtime, repository, deploy target, data class, and dependencies are expressed.

## Phase 1: CLI MVP

- Scan one folder or a list of folders.
- Validate manifest shape and required fields.
- Print diagnostics suitable for humans.
- Export normalized catalog JSON.
- Export dependency graph DOT.

## Phase 2: Static Report

- Generate a static HTML report from the same normalized catalog.
- Show service list, missing metadata, owner/runtime/deploy slices, and dependency graph.
- Keep report generation deterministic for CI diffs.

## Phase 3: CI Wrapper

- Provide a GitHub Action wrapper around the CLI.
- Support check-only validation and optional report artifact upload.
- Keep default permissions read-only.

## Explicitly Deferred

- Hosted portal, RBAC, live inventory database, Kubernetes discovery, cloud cost ingestion, incident
  workflow, and automatic ownership sync.
