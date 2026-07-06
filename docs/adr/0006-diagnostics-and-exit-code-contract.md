# Diagnostics and Exit Code Contract

Status: Accepted
Owner: 0disoft

## Decision

The CLI uses stable exit codes and stable diagnostic codes.

Exit codes:

- 0: success;
- 1: catalog validation error;
- 2: CLI usage or config error;
- 3: input read or parse error;
- 4: output write error;
- 5: internal unexpected error.

Diagnostics include severity, code, file, field, message, and hint when available.

## Context

This tool must work in CI and with coding agents. Human text alone is not enough. Stable machine
contracts let workflows fail fast and point users to the exact manifest field to fix.

## Consequences

- JSON mode is required for every command.
- Human output may change more freely than JSON output.
- Diagnostic code changes require contract-test updates and migration notes.
- `--fail-on-warning` promotes warnings to exit code 1.

## Rejected Alternatives

- Treating all failures as exit code 1.
- Letting the GitHub Action define its own exit behavior.
- Emitting full manifest contents in JSON diagnostics.
