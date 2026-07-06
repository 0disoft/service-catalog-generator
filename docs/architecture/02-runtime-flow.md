# Runtime Flow

Status: Draft

## Source of Truth

- Product decision: docs/product/02-spec.md
- Domain model: docs/architecture/01-domain-model.md
- CLI contract: docs/cli/command-contract.md
- Related ADRs: docs/adr/0006-diagnostics-and-exit-code-contract.md and docs/adr/0007-no-network-and-no-telemetry-by-default.md

## Flow

```text
configured roots
  -> discovery
  -> YAML parser
  -> schema validator
  -> normalizer
  -> dependency resolver
  -> diagnostics
  -> catalog snapshot
  -> JSON writer
  -> DOT writer
  -> HTML writer
```

## Scan Flow

1. Load CLI flags and optional `scg.config.yaml`.
2. Resolve scan roots and manifest names.
3. Apply default excludes for `.git`, `node_modules`, `dist`, `coverage`, and output directories.
4. Resolve real paths and prevent traversal outside allowed roots.
5. Read candidate manifest files within size and count limits.
6. Parse YAML with safe parser settings.
7. Validate schema and emit diagnostics.
8. Normalize valid records with stable ordering.
9. Resolve dependency references.
10. Return a `CatalogSnapshot` plus diagnostics.

## Command Behavior

- `scan` prints or writes the normalized catalog and diagnostics.
- `check` validates manifests and exits according to diagnostics and policy.
- `report` writes `catalog.json`, `graph.dot`, and `report.html` under a declared output directory.

All commands must support deterministic JSON output. Human output may be friendlier, but it cannot be
the only source of machine-readable state.

## Failure and Recovery

| Failure | Handling |
| --- | --- |
| CLI usage or config error | Exit 2 with a clear diagnostic before scanning. |
| Input read or parse error | Exit 3 and include file path plus parser-safe reason. |
| Validation error | Exit 1 with stable diagnostic codes. |
| Output write error | Exit 4 and avoid partial overwrite when possible. |
| Unexpected internal error | Exit 5 without dumping full manifest contents. |

The recovery path should always point back to a manifest field, config field, or output path. Generated
HTML, DOT, and JSON are never repaired directly.

## Network and Telemetry

Default behavior performs no network calls, remote schema fetches, telemetry, or automatic update
checks. Any future opt-in network behavior needs a new ADR.
