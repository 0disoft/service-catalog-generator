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
- typecheck-legacy
- test
- contract
- smoke
- consumer-conformance
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

TypeScript 7.0.2 owns `typecheck`, project-reference builds, declaration emit, and package builds.
TypeScript 6.0.3 remains the explicit JavaScript compiler API dependency and runs as the separate
`typecheck-legacy` compatibility gate on Ubuntu and Windows. Every compiler invocation uses an
explicit package path so package-manager binary-link order cannot select a compiler.

Third-party Actions are pinned to immutable commit SHAs. Dependabot checks npm and GitHub Actions
updates weekly, groups compatible minor and patch updates, and limits each ecosystem to three open
pull requests. Major dependency updates remain separate review units. Every hosted job has an
explicit timeout so a stalled registry, build, or analysis cannot consume the runner indefinitely.

Clarissimi is the single deliberate moving-Action exception: `.github/workflows/clarissimi.yml`
uses the maintainer-promoted `0disoft/clarissimi@v0` channel so contributor-recognition fixes arrive
without a repository edit. Its pre-merge decision job is read-only and advisory by default. Merged
pull requests create only a review draft; an approved draft is promoted through a second proposal
pull request. The two proposal jobs persist checkout credentials only for their scoped branch push,
and neither workflow path commits directly to `main`.

The workflow intentionally has no provider token. Its deterministic initial draft is only an inbox
scaffold: a maintainer or delegated coding agent must replace or correct the assessment, change its
approval status, and merge that draft before dispatching `promote-draft` with the exact checked-in
draft path. After the advisory flow has been exercised, repository variable
`CLARISSIMI_GATE_MODE=required` can make the existing decision job fail closed without renaming the
check.

Generated shell completion is parsed and registered by the native shell before merge: Bash on
Ubuntu 24.04, Zsh on macOS 15, and PowerShell on Windows Server 2025. These checks run without user
profiles, filesystem discovery, network access from completion, or interactive completion state.
The PowerShell check also requests a candidate through `TabExpansion2` so successful parsing alone
cannot hide a broken registration path.

The `release-smoke` workflow is a post-publish evidence gate rather than a publishing gate. After a
successful release it installs the exact npm version on Ubuntu and Windows, compiles the native
consumer fixture, and then verifies provenance, package signatures, release state, and tag state on
Ubuntu. Failures are release evidence for a forward fix; they do not roll back an immutable npm
publication.

Pre-publish package smoke builds the tarball twice, compares complete SHA-256 digests, and only then
installs the verified tarball into the isolated external-consumer project. This proves the committed
source and build inputs produce byte-identical package artifacts before registry publication.

## Validation

- Required validation names: docs, smoke, consumer-conformance, recovery-drill, secret-scan,
  dependency-audit, check
- Release blocker status: CI cannot publish releases if implemented gates are failing
- Remaining operational risk: dependency audit retries transient registry failures, but CI still
  depends on the package registry eventually returning audit metadata.
