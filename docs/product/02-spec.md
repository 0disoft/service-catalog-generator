# Product Specification

Status: Draft
Owner: 0disoft

## Purpose

Service Catalog Generator is a read-only CLI and report generator for small service catalogs.

It reads checked-in service manifests, validates their shape, normalizes the records, and emits
artifacts that help humans and coding agents understand a workspace without deploying a portal.

## Source of Truth

- Product decision: this document
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Users

- Solo builders with many small repositories.
- Small teams that need a service map before adopting a heavier developer portal.
- Platform teams that want file-owned catalog facts for agent workflows.
- Maintainers who need CI to catch stale or missing service metadata.

## Manifest Contract

The first manifest target is `service.yaml`. The minimum useful record should cover:

- stable service id;
- display name;
- lifecycle status;
- owner reference;
- repository URL or local repository id;
- runtime or platform family;
- deploy target;
- data ownership and data classification;
- API, database, queue, and service dependencies;
- cost reference or cost owner;
- deletion or retirement note.

The exact YAML schema remains draft until fixtures and validation tests exist.

## CLI MVP

The first CLI should expose these product-level actions:

- `scan`: read manifests and print a normalized service list;
- `check`: validate required fields and dependency references;
- `report`: write static JSON, DOT, and HTML report artifacts.

Names and flags may change before implementation, but every command must keep a machine-readable
JSON mode and deterministic exit behavior.

## Outputs

- Human diagnostics for missing or stale manifest data.
- Normalized catalog JSON for agents and downstream tools.
- Dependency graph DOT for visualization.
- Static HTML report for small-team browsing.

Generated outputs are derived artifacts. They must never become the source of truth.

## Non-Goals

- Backstage, OpsLevel, Cortex, or CMDB replacement.
- Hosted portal, login, RBAC, or team management.
- Cloud resource auto-discovery.
- Cost calculation or billing reconciliation.
- Incident management or service ownership escalation workflow.
- Automatic inference of every dependency from source code.

## Failure and Recovery

- Invalid manifests fail `check` with file path, field path, reason, and remediation hint.
- Missing optional fields produce warnings when the field affects report quality.
- Unknown dependency references are errors unless explicitly allowed by policy.
- Report generation should be safe to rerun and overwrite only declared output paths.

## Review Blockers

- A change treats generated report output as authoritative source data.
- A change adds automatic cloud or source-code discovery without a new boundary decision.
- A change stores credentials, account identifiers, customer data, or private URLs in examples.
- A change weakens manifest validation without updating fixtures and docs.
