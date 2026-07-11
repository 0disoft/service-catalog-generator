# Risk Register

Status: Active
Owner: 0disoft

## Manifest Drift

- Risk: stale manifests create a confident but false service map.
- Mitigation: validation should highlight missing review timestamps, weak owner fields, and unknown
  dependency references before report generation looks polished.
- Blocker: a change makes HTML, DOT, JSON, or generated examples the durable source of truth.

## Scope Creep Into Portal

- Risk: catalog fields expand into HR, FinOps, RBAC, incident management, and CMDB workflows.
- Mitigation: keep the MVP read-only and file-first; defer hosted state and permissions to a later
  explicit product decision.
- Blocker: a change adds service editing, login, user management, RBAC, live storage, or workflow
  assignment without a new ADR.

## Sensitive Metadata Leakage

- Risk: examples or reports expose private URLs, account identifiers, customer data, or secrets.
- Mitigation: examples must use synthetic values, and report output must avoid secret-like fields by
  default.
- Blocker: a fixture, example, report, or release asset includes private repository URLs, cloud
  account IDs, customer names, real owner emails, incident channels, or credential-shaped values.

## Noisy Dependency Graphs

- Risk: automatic dependency inference creates false edges and erodes trust.
- Mitigation: start with explicit manifest-declared dependencies; treat auto-discovery as deferred.
- Blocker: a dependency edge is inferred from source code, cloud resources, Terraform state, or
  Kubernetes inventory during the MVP.

## Heavier Alternatives

- Risk: competing against mature developer portals makes the project an underpowered clone.
- Mitigation: optimize for file-owned manifests, deterministic static output, CI checks, and agent
  readability.

## Split-Brain Policy

- Risk: CLI, GitHub Action, and HTML report each implement their own validation rules.
- Mitigation: schema owns type contracts, core owns validation, CLI displays results, report writes
  derived artifacts, and action wraps CLI behavior only.
- Blocker: action or report code duplicates manifest validation policy outside the core package.

## Path and Output Safety

- Risk: path traversal, symlink loops, broad scans, or unsafe output overwrites expose files or damage
  a workspace.
- Mitigation: default excludes, realpath tracking, output-directory allowlists, atomic writes, and
  tests for traversal and symlink loops.

## Runtime and Release Drift

- Risk: runtime floor, Action runtime, npm provenance, and package metadata drift apart.
- Mitigation: record runtime and release decisions in ADRs, verify them before release workflow
  changes, and use the same version stream for npm, GitHub Release, and Action tags.
