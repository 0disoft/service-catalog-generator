# Design Review Questions

Status: Draft

## Contract

Design review questions must cover problem boundary, ownership, data/state, failure and recovery, future cost, and source-of-truth drift.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/README.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Questions

- Does this keep the product read-only, manifest-first, deterministic, and CI-friendly?
- Does the change point users back to `service.yaml` or `scg.config.yaml` for fixes?
- Does it avoid hosted portal behavior, live database state, RBAC, telemetry, and network calls?
- Does it preserve the package boundary between schema, core, CLI, report, and action?
- Does it avoid automatic dependency discovery from source code, cloud resources, Kubernetes, or
  Terraform?
- Does generated JSON, DOT, or HTML remain derived output?
- Are examples, fixtures, docs, and release assets synthetic?
- Are path, symlink, output overwrite, HTML escaping, DOT escaping, and terminal-control risks
  handled where relevant?
- Are diagnostics stable enough for CI and agents?
- If a contract changed, were ADRs, fixtures, tests, and migration notes updated?

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
