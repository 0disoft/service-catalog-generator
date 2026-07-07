# CI

Status: Draft

## Operational Boundary

CI validates the repository, package contracts, and generated artifacts. It must not require cloud
credentials, long-running services, write permissions, telemetry, or private catalog data.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Required Gates

- format
- lint
- typecheck
- test
- contract
- smoke
- docs
- secret-scan
- dependency-audit
- check

Unimplemented gates must fail clearly or be reported as skipped. Fake passing scripts are blockers.

## Validation

- Required validation names: docs, smoke, secret-scan, dependency-audit, check
- Release blocker status: CI cannot publish releases if implemented gates are failing
- Remaining operational risk: CI depends on the package registry being reachable for dependency
  audit metadata.
