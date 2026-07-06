# Config and Environment

Status: Draft

## Operational Boundary

Catalog behavior is configured through CLI flags and `scg.config.yaml`. Environment variables must
not secretly change validation policy.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Environment Rules

- `NO_COLOR` may affect terminal color only.
- `CI` may affect human-output defaults only.
- No environment variable may enable telemetry, network calls, cloud discovery, or write behavior.
- Secrets are not required for normal CLI or Action usage.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: hidden environment-driven behavior is a blocker
- Remaining operational risk: config schema still needs implementation tests
