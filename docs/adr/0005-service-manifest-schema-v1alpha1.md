# Service Manifest Schema v1alpha1

Status: Superseded In Part By ADR 0015
Owner: 0disoft

## Decision

The first manifest schema is `scg.service/v1alpha1` in `service.yaml`.

ADR 0015 promotes this unchanged field shape to `scg.service/v1` and retains the alpha id as a 1.x
input compatibility alias.

Required fields are `schemaVersion`, `id`, `name`, `lifecycle`, `owner.type`, `owner.ref`,
`repository`, `runtime`, `deploy`, `data.classification`, and `metadata.lastReviewedAt`.

## Context

The product earns trust by making service ownership, runtime, deployment, data classification, review
age, and dependency declarations explicit. The schema should stay small enough for small teams to
adopt and strict enough for CI to catch stale or missing catalog data.

## Consequences

- `dependencies: []` is valid and means dependencies were reviewed.
- Owner refs should be stable refs, not real personal email addresses.
- Data fields describe data classification, not customer records or internal database endpoints.
- Schema changes before 1.0 require fixture updates and migration notes.
- Schema changes after 1.0 are compatibility changes.

## Rejected Alternatives

- Auto-generating catalog facts from source code, cloud resources, Kubernetes, or Terraform in the
  MVP.
- Accepting generated report edits as catalog changes.
- Starting with a large enterprise taxonomy before fixtures exist.
