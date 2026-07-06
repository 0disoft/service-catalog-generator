# Initial Architecture Boundaries

Status: Accepted
Owner: 0disoft

## Decision

Service Catalog Generator starts as a read-only, file-first catalog generator.

The repository owns a CLI, optional GitHub Action wrapper, and static report contract. It does not
own a hosted portal, live service database, cloud discovery engine, permissions system, incident
workflow, or cost reconciliation system.

## Context

The product exists because small teams and solo builders need a service map before they need a full
developer portal. The useful first boundary is checked-in manifests plus deterministic generated
views.

## Consequences

- `service.yaml` manifests remain the source of truth.
- Generated JSON, DOT, and HTML outputs are derived artifacts.
- Validation errors should point back to manifest file paths and fields.
- Automatic cloud, Kubernetes, Terraform, or source-code discovery is deferred until a new ADR
  accepts that boundary.
- Any GitHub Action wrapper must call the same CLI behavior instead of owning a second policy layer.

## Review Blockers

- A change introduces persistent catalog state without a new ADR.
- A change treats generated output as authoritative input.
- A change expands into portal, RBAC, incident, or cost-management behavior without changing the
  product boundary first.
