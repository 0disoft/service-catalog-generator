# CLI Tool

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

## CLI Boundary

The CLI is the primary interface. It owns command parsing, help text, config precedence, output mode
selection, and exit-code mapping. Validation policy belongs to the core engine and schema contracts.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
