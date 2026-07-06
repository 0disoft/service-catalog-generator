# Command Contract

Status: Draft
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Command list and flag ownership: draft commands are `scan`, `check`, and `report`.
- Exit-code taxonomy: success, validation failure, input/config error, and internal error need
  distinct exits before implementation.
- Machine-readable output contract: JSON output must include services, diagnostics, graph edges, and
  summary counts without embedding source file contents.
- Config precedence and default behavior: CLI flags should override config files; config file shape
  remains UNDECIDED.
- Runtime compatibility floor: UNDECIDED.

## Draft Commands

- `scan`: discover manifests and print normalized catalog records.
- `check`: validate required fields, schema shape, stale metadata, and dependency references.
- `report`: write declared static report artifacts such as catalog JSON, DOT graph, and HTML.

Each command should support human-readable output and a JSON mode. JSON mode must be deterministic
enough for CI and should never include secrets or full source file contents.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
