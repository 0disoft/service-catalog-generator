# Testing Standard

Status: Draft

## Contract

Testing standard defines merge-blocking expectations for unit, integration, contract, migration, smoke, docs, and regression evidence.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/architecture/03-quality-attributes.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Test Layers

| Test layer | Purpose |
| --- | --- |
| Schema fixture tests | Prove valid and invalid `service.yaml` examples behave as expected. |
| Parser tests | Cover invalid YAML, file size limits, unusual scalar values, and parser-safe errors. |
| Normalizer tests | Cover defaults, stable sorting, and deterministic snapshots. |
| Validator tests | Cover required fields, lifecycle enums, stale review dates, and unknown dependencies. |
| Graph tests | Cover service edges, external edges, unknown nodes, and cycles. |
| CLI contract tests | Lock JSON output shape and exit codes. |
| Golden output tests | Lock `catalog.json`, `graph.dot`, and `report.html` from synthetic examples. |
| Publication tests | Prove report generation replacement, writer exclusion, rollback, and path safety on Ubuntu and Windows hosted runners. |
| Security tests | Cover XSS, DOT injection, path traversal, symlink loops, and secret-like values. |
| Action tests | Cover input mapping, permission assumptions, output mapping, and CLI exit propagation. |
| E2E tests | Run a tiny synthetic workspace through scan, check, and report. |
| Native consumer tests | Compile the standalone `examples/native-consumer` repository through source, packed CLI, and Action paths. |
| Source compatibility tests | Verify custom manifest names, global excludes, case semantics, and realpath aliases on Ubuntu and Windows. |
| Performance tests | Measure native and mixed 500/1,000-manifest workspaces plus 100/5,000-source scaling against documented budgets. |

## Required Fixtures

- `valid-minimal.service.yaml`
- `valid-full.service.yaml`
- `invalid-missing-owner.service.yaml`
- `invalid-unknown-dependency.service.yaml`
- `invalid-secret-like-value.service.yaml`
- `invalid-bad-schema-version.service.yaml`

Fixtures must be synthetic and must not include real organization data.

## Performance Budgets

- 500 manifests under 2 seconds on a typical developer laptop.
- 500 manifests under 5 seconds on a GitHub hosted runner.
- 1,000 manifests with peak memory below 256 MB as an initial target.
- 5,000 source declarations under 2 seconds.
- 100 real roots and 500 mixed manifests within the normal scan budget.
- 1,000 mixed manifests with peak memory below 256 MB.

Budgets may be revised with measurement evidence.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
- A contract change lacks fixture, golden, or CLI output evidence.
