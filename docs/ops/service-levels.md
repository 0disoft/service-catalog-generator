# Service Levels

Status: Draft

## Operational Boundary

The MVP has no hosted uptime SLA. Service levels describe local CLI and CI expectations.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Targets

- Deterministic output for the same inputs.
- Stable exit code meanings.
- Stable diagnostic codes after contract freeze.
- 500 manifests under 2 seconds locally and under 5 seconds on GitHub hosted runners as an initial
  performance target.
- No default network dependency.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: hosted SLA claims are blocked until hosted behavior exists
- Remaining operational risk: performance targets still need measured implementation evidence
