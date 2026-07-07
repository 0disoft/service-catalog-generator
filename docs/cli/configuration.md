# CLI Configuration

Status: Draft
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0006-diagnostics-and-exit-code-contract.md

## Required Decisions

- Command list and flag ownership: docs/cli/command-contract.md
- Exit-code taxonomy: docs/cli/output-and-exit-codes.md
- Machine-readable output contract: docs/cli/output-and-exit-codes.md
- Config precedence and default behavior: CLI flags, config file, defaults.
- Runtime compatibility floor: Node.js 24 LTS.

## Config File

The default config filename is `scg.config.yaml`.

```yaml
schemaVersion: scg.config/v1alpha1

scan:
  roots:
    - .
  manifestNames:
    - service.yaml
  exclude:
    - .git/**
    - node_modules/**
    - dist/**
    - coverage/**
    - .catalog/**

validation:
  failOnWarnings: false
  allowUnknownDependencies: false
  requireLastReviewedAt: true
  staleAfterDays: 90

output:
  directory: .catalog
  formats:
    - json
    - dot
    - html
  deterministic: true

privacy:
  redactRepositoryUrls: false
  redactOwnerEmails: true
```

## Precedence

1. CLI flags.
2. `scg.config.yaml` or file passed through `--config`.
3. Built-in defaults.

Environment variables must not override catalog semantics. `NO_COLOR` may affect terminal color and
`CI` may affect human-output defaults, but neither may change validation policy.

## Defaults

- Root: current working directory.
- Manifest name: `service.yaml`.
- Input schema: `scg-v1`; use `--input-schema zdp-v2` for ZDP v2 manifests.
- Output directory: `.catalog`.
- Formats: JSON for `scan`, no write for `check`, JSON/DOT/HTML for `report`.
- Unknown dependencies: failing diagnostic by default.
- Warnings: non-failing unless `--fail-on-warning` is set.
- Network calls: none.
- Telemetry: none.

## Review Blockers

- A new config field bypasses the documented precedence order.
- A config value enables network calls, telemetry, or auto-discovery without a new ADR.
- A config default scans generated, dependency, cache, or VCS directories.
- A config default can overwrite source manifests or root repository files.
