# CLI Tool

Status: Draft
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: UNDECIDED
- Technical owner: UNASSIGNED
- Related ADR: UNDECIDED

## Required Decisions

- Command list and flag ownership: UNDECIDED
- Exit-code taxonomy: UNDECIDED
- Machine-readable output contract: UNDECIDED
- Config precedence and default behavior: UNDECIDED
- Runtime compatibility floor: UNDECIDED

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
