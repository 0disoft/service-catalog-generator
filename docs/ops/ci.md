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

Oxfmt owns formatting checks and Oxlint owns JavaScript and TypeScript lint rules. TypeScript
continues to own type checking, project-reference builds, and declaration emit; the lint gate must
not replace the `typecheck` gate without a separate compatibility decision and equivalent release
evidence.

Third-party Actions are pinned to immutable commit SHAs. Dependabot checks npm and GitHub Actions
updates weekly, groups compatible minor and patch updates, and limits each ecosystem to three open
pull requests. Major dependency updates remain separate review units. Every hosted job has an
explicit timeout so a stalled registry, build, or analysis cannot consume the runner indefinitely.

The `release-smoke` workflow is a post-publish evidence gate rather than a publishing gate. After a
successful release it installs the exact npm version on Ubuntu and Windows, compiles the native
consumer fixture, and then verifies provenance, package signatures, release state, and tag state on
Ubuntu. Failures are release evidence for a forward fix; they do not roll back an immutable npm
publication.

## Validation

- Required validation names: docs, smoke, recovery-drill, secret-scan, dependency-audit, check
- Release blocker status: CI cannot publish releases if implemented gates are failing
- Remaining operational risk: dependency audit retries transient registry failures, but CI still
  depends on the package registry eventually returning audit metadata.
