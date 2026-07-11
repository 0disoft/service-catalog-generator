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
- recovery-drill
- secret-scan
- dependency-audit
- check

Unimplemented gates must fail clearly or be reported as skipped. Fake passing scripts are blockers.

Third-party Actions are pinned to immutable commit SHAs. Dependabot checks npm and GitHub Actions
updates weekly, groups compatible minor and patch updates, and limits each ecosystem to three open
pull requests. Major dependency updates remain separate review units. Every hosted job has an
explicit timeout so a stalled registry, build, or analysis cannot consume the runner indefinitely.

## Validation

- Required validation names: docs, smoke, recovery-drill, secret-scan, dependency-audit, check
- Release blocker status: CI cannot publish releases if implemented gates are failing
- Remaining operational risk: dependency audit retries transient registry failures, but CI still
  depends on the package registry eventually returning audit metadata.
