# Backup and Restore

Status: Deferred

## Operational Boundary

The MVP has no database, object store, hosted report store, or managed backup target.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Policy

- Source truth is Git-tracked `service.yaml` and `scg.config.yaml` in user repositories.
- Generated reports can be regenerated from source truth.
- This project must not promise backup or restore for user catalog data.

## Validation

- Required validation names: docs, check
- Release blocker status: no backup feature may ship without a new ADR
- Remaining operational risk: users must protect their own repositories and CI artifacts
