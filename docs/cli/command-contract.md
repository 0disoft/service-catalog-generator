# Command Contract

Status: Stable Pre-1.0
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Command list and flag ownership: draft commands are `scan`, `check`, and `report`.
- Exit-code taxonomy: documented in docs/cli/output-and-exit-codes.md.
- Machine-readable output contract: JSON output must include services, diagnostics, graph edges, and
  summary counts without embedding source file contents.
- Config precedence and default behavior: CLI flags override `scg.config.yaml`, which overrides
  defaults.
- Runtime compatibility floor: Node.js 24 LTS.

## Commands

- `scg scan`: discover manifests and print normalized catalog records.
- `scg check`: validate required fields, schema shape, stale metadata, and dependency references.
- `scg report`: stage and publish declared static report artifacts such as catalog JSON, DOT graph,
  and HTML as one directory generation. The output path is a dedicated generated directory, not a
  container for user-owned files.

Each command should support human-readable output and a JSON mode. JSON mode must be deterministic
enough for CI and should never include secrets or full source file contents.

All successful JSON modes include the complete `CatalogSnapshot`. The `report` command adds a
top-level `files` array describing written artifacts without removing snapshot fields.

## Flags

| Flag                              | Applies to        | Meaning                                                                                              |
| --------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `--root <path>`                   | all               | Add a scan root. May be repeated.                                                                    |
| `--config <path>`                 | all               | Load config file. Defaults to `scg.config.yaml` when present.                                        |
| `--manifest <name>`               | all               | Manifest filename. Defaults to `service.yaml`.                                                       |
| `--format <format>`               | `scan`, `report`  | Output format such as `json`, `dot`, or `html`.                                                      |
| `--out <path>`                    | `report`          | Output directory. Defaults to `.catalog`.                                                            |
| `--fail-on-warning`               | `check`, `report` | Promote warnings to a failing exit.                                                                  |
| `--no-fail-on-warning`            | `check`, `report` | Override config and keep warnings non-failing.                                                       |
| `--allow-unknown-dependencies`    | all               | Permit dependency refs without matching service records.                                             |
| `--no-allow-unknown-dependencies` | all               | Override config and reject dependency refs without matching service records.                         |
| `--input-schema <schema>`         | all               | Select the input manifest adapter. Supported values are `scg-v1` and `zdp-v2`. Defaults to `scg-v1`. |
| `--json`                          | all               | Emit machine-readable diagnostics and summaries.                                                     |
| `--summary-json`                  | all               | Emit bounded summary, diagnostics, and report file metadata without services or graph data.          |
| `--no-color`                      | all               | Disable terminal color and ANSI output.                                                              |

Input schema adapters normalize existing manifest formats into the SCG catalog model. Adapter
selection must be explicit; the CLI must not silently autodetect competing service manifest formats.

Environment variables must not change product behavior except for terminal conventions such as
`NO_COLOR` and CI detection.

## Package Boundary

The CLI package owns command parsing, help text, config precedence, exit code mapping, and output
mode selection. It must call the core engine for manifest discovery and validation. It must not
reimplement schema rules or GitHub Action behavior.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
