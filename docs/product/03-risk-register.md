# Risk Register

Status: Draft
Owner: 0disoft

## Manifest Drift

- Risk: stale manifests create a confident but false service map.
- Mitigation: validation should highlight missing review timestamps, weak owner fields, and unknown
  dependency references before report generation looks polished.

## Scope Creep Into Portal

- Risk: catalog fields expand into HR, FinOps, RBAC, incident management, and CMDB workflows.
- Mitigation: keep the MVP read-only and file-first; defer hosted state and permissions to a later
  explicit product decision.

## Sensitive Metadata Leakage

- Risk: examples or reports expose private URLs, account identifiers, customer data, or secrets.
- Mitigation: examples must use synthetic values, and report output must avoid secret-like fields by
  default.

## Noisy Dependency Graphs

- Risk: automatic dependency inference creates false edges and erodes trust.
- Mitigation: start with explicit manifest-declared dependencies; treat auto-discovery as deferred.

## Heavier Alternatives

- Risk: competing against mature developer portals makes the project an underpowered clone.
- Mitigation: optimize for file-owned manifests, deterministic static output, CI checks, and agent
  readability.
