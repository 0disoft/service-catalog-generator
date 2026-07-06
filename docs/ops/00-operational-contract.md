# Operational Contract

Status: Draft

## Operational Boundary

The MVP is a local CLI, static report generator, and GitHub Action wrapper. It has no hosted service,
database, background worker, runtime fleet, or live incident workflow.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Operational Responsibilities

- Keep validation commands honest.
- Keep release and rollback docs current.
- Keep generated reports local or synthetic unless a user explicitly publishes them.
- Keep GitHub Action permissions read-only by default.
- Keep network calls and telemetry disabled by default.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: hosted-service requirements are blockers unless a new ADR accepts them
- Remaining operational risk: first release still needs package, CI, and provenance verification
