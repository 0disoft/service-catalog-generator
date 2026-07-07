# Disaster Recovery

Status: Deferred

## Operational Boundary

The MVP has no hosted runtime or persistent service state. Disaster recovery is limited to source
repository recovery, package rollback, and Action tag rollback.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Recovery Paths

- Restore user manifests from Git history.
- Regenerate reports from manifests.
- Deprecate or replace broken npm releases.
- Move floating Action tags back to a known-good commit when needed.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: hosted DR requirements require a new ADR
- Remaining operational risk: package and Action rollback now apply to released versions; recovery
  drills are not automated.
