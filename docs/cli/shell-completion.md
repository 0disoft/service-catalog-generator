# Shell Completion

Status: Implemented Pre-1.0
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

## Usage

Generate completion source for the current shell:

```powershell
scg completion powershell | Out-String | Invoke-Expression
```

```sh
source <(scg completion bash)
```

```zsh
source <(scg completion zsh)
```

For persistent setup, redirect the generated source into the shell's normal user completion path.
SCG only emits static command, flag, shell, format, and adapter candidates. Completion generation
does not inspect the filesystem, read config, scan manifests, or make network calls.

Command and flag candidates come from `packages/cli/src/command-metadata.ts`, which also renders
`scg --help`. A command or flag change must update this single metadata surface and its tests.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
