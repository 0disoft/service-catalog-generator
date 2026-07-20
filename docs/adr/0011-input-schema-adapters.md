# Input Schema Adapters

Status: Accepted
Owner: 0disoft

## Purpose

Service Catalog Generator remains a generic read-only service manifest compiler. It can support
existing service manifest formats only through explicit input schema adapters that normalize those
formats into the SCG catalog model.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0005-service-manifest-schema-v1alpha1.md
- Stable schema promotion: docs/adr/0015-stable-v1-contract-and-release-channels.md
- Source-scoped extension: docs/adr/0013-source-scoped-input-adapters.md

## Decision

The core SCG manifest schema is `scg.service/v1`; the final alpha id remains a 1.x compatibility
alias. Adapter support is selected explicitly through the input schema option exposed by the CLI
and GitHub Action.

This ADR owns adapter identity and normalization boundaries. ADR 0013 owns the accepted design for
assigning different explicit adapters to non-overlapping roots in one catalog run.

The first first-party adapter is `zdp-v2`. It reads ZDP `service.yaml` manifests with
`contract.schema_version: 2`, maps their stable service fields into the SCG catalog model, and keeps
ZDP-specific metadata under `extensions.zdp`.

The adapter requires `contract.last_reviewed_at` in `YYYY-MM-DD` form because the stable SCG
catalog requires `metadata.lastReviewedAt`. Missing or malformed source dates fail with
`adapter.invalid_input`; the adapter never invents a sentinel review date.

SCG does not enforce ZDP architecture policy. ZDP policy validation remains owned by
`zdp-architecture-linter`; SCG only reads, normalizes, reports, and maps dependencies for catalog
artifacts.

## Rejected Alternatives

- Make ZDP v2 the core SCG schema. This would make SCG project-specific and weaken its OSS catalog
  role.
- Silently autodetect manifest formats. This creates ambiguous behavior when repositories contain
  similar YAML shapes with different policy owners.
- Duplicate ZDP policy validation in SCG. That would split the policy source of truth and make drift
  likely.

## Required Validation

- CLI tests cover explicit adapter selection and unsupported adapter values.
- Core tests cover ZDP v2 normalization into SCG service records.
- Action tests cover input mapping for `input-schema`.
- Contract tests cover `extensions` in catalog service records.

## Review Blockers

- A change makes ZDP fields required in the core SCG schema.
- A change enables silent input schema autodetection.
- A change moves ZDP policy validation out of `zdp-architecture-linter` and into SCG.
