# Observability

Status: Draft

## Operational Boundary

The MVP has no hosted telemetry, metrics backend, traces, dashboards, or alerts. Observability is CLI
diagnostics, JSON summaries, exit codes, and optional generated reports.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Signals

- Exit code.
- Diagnostic severity counts.
- Stable diagnostic codes.
- Service count, warning count, error count, and edge count.
- Output write path when report generation succeeds.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: telemetry or external observability requires a new ADR
- Remaining operational risk: human-readable CLI diagnostic formatting has implementation coverage;
  broader report presentation regressions still rely on smoke and report tests.
