# Product Specification

Status: Active Pre-1.0
Owner: 0disoft

## Purpose

Service Catalog Generator is a read-only `service.yaml` compiler and linter for small service
catalogs.

It reads checked-in service manifests, validates their shape, normalizes the records, and emits
deterministic artifacts that help humans and coding agents understand a workspace without deploying a
portal.

## Source of Truth

- Product decision: this document
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Users

- Solo builders with many small repositories.
- Small teams that need a service map before adopting a heavier developer portal.
- Platform teams that want file-owned catalog facts for agent workflows.
- Maintainers who need CI to catch stale or missing service metadata.

## Product Identity

The project must stay read-only, manifest-first, deterministic, and CI-friendly.

The product competes with stale spreadsheets, READMEs, wiki pages, chat threads, and tribal memory.
It does not compete with hosted developer portals. The primary value is telling a maintainer which
manifest field is wrong, missing, stale, unsafe, or impossible to resolve.

## Manifest Contract

The first manifest target is `service.yaml` with schema version `scg.service/v1alpha1`. The minimum
useful record covers:

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

Required fields are:

- `schemaVersion`;
- `id`;
- `name`;
- `lifecycle`;
- `owner.type`;
- `owner.ref`;
- `repository`;
- `runtime`;
- `deploy`;
- `data.classification`;
- `metadata.lastReviewedAt`.

`dependencies` may be an empty array. An explicit empty dependency list means the service owner has
reviewed the service and found no declared dependencies.

```yaml
schemaVersion: scg.service/v1alpha1
id: billing-api
name: Billing API
lifecycle: production
owner:
  type: team
  ref: platform
repository:
  provider: github
  slug: example/billing-api
runtime:
  language: typescript
  platform: node
  framework: fastify
deploy:
  type: container
  targets:
    - environment: production
      provider: unknown
      ref: billing-api-prod
data:
  storesPersonalData: false
  classification: internal
dependencies:
  - type: service
    target: auth-api
    direction: outbound
    criticality: required
    reason: validates user sessions
cost:
  owner: platform
retirement:
  status: none
metadata:
  lastReviewedAt: "2026-07-01"
```

The schema remains pre-1.0 while external adoption, compatibility classification, and migration
review continue. Fixtures and contract tests already lock current behavior against accidental drift.

Existing manifest formats may be supported through explicit input schema adapters. These adapters
must normalize external records into the SCG catalog model without turning those external policy
contracts into the core SCG schema. Adapter-specific fields may be preserved under `extensions`, but
policy validation remains owned by the source contract.

Mixed catalogs may assign adapters through config `sources`. Every manifest has one disjoint
workspace-contained root owner, while duplicate IDs, dependencies, graph generation, validation
policy, and resource limits are evaluated once across the combined normalized catalog. SCG never
autodetects a schema from YAML shape.

## CLI Contract

The CLI exposes these product-level actions:

- `scan`: read manifests and print a normalized service list;
- `check`: validate required fields and dependency references;
- `report`: write static JSON, DOT, and HTML report artifacts.

Command names, documented flags, machine-readable JSON mode, and deterministic exit behavior are
public pre-1.0 contracts. A breaking change requires a changelog entry and migration note.

## Outputs

- Human diagnostics for missing or stale manifest data.
- Normalized catalog JSON for agents and downstream tools.
- Dependency graph DOT for visualization.
- Static HTML report for small-team browsing.

Generated outputs are derived artifacts. They must never become the source of truth.

## Runtime, Licensing, and Packaging

- Runtime floor: Node.js 24 LTS.
- Language: TypeScript with strict type checking.
- Package manager: pnpm workspace.
- Public package name: `@0disoft/service-catalog-generator`.
- CLI binary: `scg`.
- Project license: Apache-2.0.
- GitHub Action metadata: root `action.yml`.
- Generated HTML reports: CI/internal artifacts by default; public release assets must use synthetic
  examples only.

The repository should stay a single public monorepo until the manifest, CLI, and report contracts are
stable enough to justify splitting packages or repositories.

## Non-Goals

- Backstage, OpsLevel, Cortex, or CMDB replacement.
- Hosted portal, login, RBAC, or team management.
- Cloud resource auto-discovery.
- Kubernetes, Terraform state, source-code, or package-import dependency auto-discovery in the MVP.
- Cost calculation or billing reconciliation.
- Incident management or service ownership escalation workflow.
- Automatic inference of every dependency from source code.
- Web server, live database, telemetry, automatic update check, or remote schema fetch by default.

## Failure and Recovery

- Invalid manifests fail `check` with file path, field path, reason, and remediation hint.
- Missing optional fields produce warnings when the field affects report quality.
- Unknown dependency references are errors unless explicitly allowed by policy.
- Report generation should be safe to rerun and overwrite only declared output paths.
- Aggregate resource limits fail the complete catalog instead of publishing a plausible-looking
  partial service map.
- Config loading has a fixed bootstrap byte limit because config-owned limits cannot govern the
  file that defines them.
- An optional minimum service count can fail a catalog whose final valid normalized service set is
  unexpectedly small; the default remains zero so intentional empty repositories stay valid.
- Diagnostics use stable codes so CI, agents, and tests can key off them.

## Review Blockers

- A change treats generated report output as authoritative source data.
- A change adds automatic cloud or source-code discovery without a new boundary decision.
- A change stores credentials, account identifiers, customer data, or private URLs in examples.
- A change weakens manifest validation without updating fixtures and docs.
- A change adds portal editing, login, RBAC, live DB storage, network calls, or telemetry without a new
  ADR.
