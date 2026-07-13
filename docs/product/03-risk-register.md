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
- Mitigation: default excludes, realpath tracking, output-directory allowlists, a dedicated
  directory-generation protocol, owner-marked report sets, single-writer locking, rollback, and
  tests for traversal, symlinks, writer exclusion, stale-format removal, and promotion failure.
- Remaining risk: directory promotion prevents mixed generations but can expose a brief missing-path
  window on filesystems that cannot replace a non-empty directory in one operation. A process with
  workspace write access can ignore SCG's lock or race path validation by replacing directories.
  Crash-retained locks deliberately require inspection instead of unsafe age-based auto-breaking.
- Blocker: claiming uninterrupted reader availability or protection from hostile same-user
  filesystem mutation without a stronger platform-specific filesystem primitive.

## Resource Exhaustion

- Risk: individually valid manifests can collectively exceed practical memory and output budgets,
  especially when large extension payloads are retained in snapshots and reports.
- Mitigation: per-manifest byte limits, manifest-count limits, bounded parsing concurrency, bounded
  glob matching, aggregate input/extension/collection/report budgets, object-depth limits, and
  summary-only Action output. Resource failures discard the partial catalog.
- Remaining risk: defaults are measured against the maintained 1,000-service synthetic fixture and
  current ZDP adoption, not a broad distribution of unrelated public consumers.
- Blocker: freezing 1.0 limits without published migration behavior and additional native consumer
  distributions.

## Empty And Mixed Catalog Policy

- Risk: a successful zero-service result can hide a bad root or manifest name, while forcing one
  service can break intentional empty-repository checks. A single run-wide adapter also prevents
  explicitly configured mixed-schema adoption.
- Mitigation: consumers should currently pin roots, manifest names, input schema, and expected
  service-count evidence in their own CI gates.
- Blocker: adding implicit schema detection. Pre-1.0 design must define explicit minimum-service
  policy and per-source adapter selection, including overlap and precedence errors.

## Runtime and Release Drift

- Risk: runtime floor, Action runtime, npm provenance, and package metadata drift apart.
- Mitigation: record runtime and release decisions in ADRs, verify them before release workflow
  changes, and use the same version stream for npm, GitHub Release, and Action tags.
