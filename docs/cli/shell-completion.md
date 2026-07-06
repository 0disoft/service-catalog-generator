# Shell Completion

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
- Config precedence and default behavior: docs/cli/configuration.md
- Runtime compatibility floor: Node.js 24 LTS

## Completion Boundary

Shell completion may expose commands, flags, and enum-like values. It must not make filesystem scans,
network calls, or validation decisions while completing input.

Completion output must be generated from the same command metadata used by the CLI help text once the
CLI exists.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
