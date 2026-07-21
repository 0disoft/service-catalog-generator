# Release

Status: Active 1.0 Stable

## Operational Contract

Cover release types, versioning, pre-release checklist, deployment flow, post-deploy verification, stop conditions, and owner handoff.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Validation

- Required validation names: format, lint, typecheck, typecheck-legacy, test, contract, smoke,
  consumer-conformance, docs, recovery-drill, release-evidence, registry-smoke,
  released-action-smoke, check
- Release blocker status: any missing implemented validation is a blocker unless documented as not
  yet configured
- Remaining operational risk: package availability, Trusted Publishing, release-channel
  isolation, and Action runtime support are verified for `1.0.1`; each future release must
  rerun `release-evidence` and reverify Trusted Publishing before promotion

## Release Units

- npm package: `@0disoft/service-catalog-generator`.
- CLI binary: `scg`.
- GitHub Release: same version as npm.
- GitHub Action tag: exact version tags for prereleases and a moving major tag for stable releases.
- npm channel: `next` for prereleases and `latest` for stable releases.

## Version Plan

| Version | Scope                                                     |
| ------- | --------------------------------------------------------- |
| `0.1.0` | Schema, fixtures, docs, empty CLI skeleton.               |
| `0.2.0` | `scan`, `check`, JSON diagnostics.                        |
| `0.3.0` | DOT export and static HTML report.                        |
| `0.4.0` | GitHub Action wrapper.                                    |
| `0.5.0` | Security hardening, deterministic output, docs polish.    |
| `0.5.1` | Trusted Publishing release validation.                    |
| `0.5.2` | npm bin metadata normalization.                           |
| `0.5.3` | Public security policy and npm package security metadata. |
| `0.5.4` | Catalog integrity and release hardening.                  |
| `0.5.5` | Discovery exclude glob fix and catalog hardening release. |
| `0.5.6` | Linux packed CLI entrypoint fix.                          |
| `0.5.7` | Action output integrity and redacted repository cleanup.  |
| `0.5.8` | Release recovery, parse throughput, and config cleanup.   |
| `0.5.9` | Diagnostic fallback and migration-note cleanup.           |
| `0.5.10` | ZDP Action smoke coverage and adoption boundary docs.     |
| `0.5.11` | Committed Action bundle version alignment.                |
| `0.5.12` | Release integrity and repository operations hardening.    |
| `0.5.13` | Stable-ID normalization ReDoS hardening.                  |
| `0.5.14` | Catalog boundary, graph, Action, and resource hardening.   |
| `0.5.15` | Report publication, resource budgets, and compatibility.  |
| `0.5.16` | Release evidence and Oxc quality-toolchain migration.      |
| `0.5.17` | Cross-platform post-publish registry smoke automation.     |
| `0.5.18` | Minimum normalized-service validation policy.              |
| `0.5.19` | Source-scoped mixed input adapters and consumer evidence.   |
| `0.5.20` | Precise config diagnostics and mixed registry smoke.         |
| `0.5.21` | Source scaling, input bounds, compatibility, and completion. |
| `1.0.0-rc.1` | Stable v1 schemas, compatibility aliases, and release-channel proof. |
| `1.0.0-rc.2` | ZDP review-date validation and bounded manifest-read forward fix. |
| `1.0.0` | Manifest schema and CLI contract freeze.                  |

Pre-1.0 breaking changes are allowed only with clear migration notes. After 1.0, manifest schema,
CLI JSON output, and exit codes are compatibility contracts.

## Release Flow

1. Confirm source-of-truth docs and ADRs are current.
2. Run configured validation commands.
3. Confirm examples and fixtures are synthetic.
4. Confirm generated reports are not published as public assets unless synthetic.
5. Confirm `package.json` repository metadata matches the public GitHub repository.
6. Run `recovery-drill` to confirm release, rollback, and disaster-recovery contracts have not
   drifted.
7. Run package smoke and require two independent `pnpm pack` executions to produce the same complete
   tarball SHA-256 before testing the packed external consumer.
8. Push an immutable `vX.Y.Z` tag that exactly matches `package.json.version`.
9. Use the `release` workflow to create the GitHub Release.
10. For a stable release, move or create the corresponding major Action tag. For a prerelease, leave
   the major tag unchanged. Publish through npm Trusted Publishing and GitHub OIDC using `latest`
   for stable releases and `next` for prereleases.
11. If the workflow fails before npm publish completes, confirm the automatic recovery step removed
   the GitHub Release and restored or deleted the mutable major Action tag.
12. If npm publish succeeds but downstream evidence later fails, treat the package as immutable and
   cut a forward-fix patch release rather than trying to rewrite the published version.
13. Smoke test package installation and dispatch `released-action-smoke` so GitHub resolves the
    exact public Action tag on Ubuntu and Windows.
14. Run `pnpm run release-evidence -- <version>` after promotion.

After a successful `release` workflow, `release-smoke` installs the exact published npm version on
Ubuntu and Windows and compiles canonical v1, legacy alpha-input, and mixed-adapter consumer
fixtures. The evidence job runs only after both registry smoke jobs pass, then verifies npm
provenance and signatures, npm dist-tag ownership, the GitHub Release, the immutable version tag,
stable-only major Action tag policy, and the originating release workflow. Registry visibility is
retried for up to 60 seconds before the smoke fails.

The registry and packed-tarball smoke paths copy `conformance/external-consumer` to a temporary
project before installation. That project imports no workspace package or repository test helper.
Normal CI installs npm `latest` through the same project on Ubuntu and Windows, while release smoke
replaces the dependency with the exact released version or packed tarball.

The separate `released-action-smoke` workflow runs after a successful release and supports manual
replay. It invokes the exact package-version Action tag for canonical v1, legacy alpha-input, and
mixed ZDP consumers on Ubuntu and Windows. Stable releases and manual replays also invoke the moving
major Action tag with the canonical v1 consumer on both runners. Prerelease-triggered runs skip the
major-channel job so an older stable Action is not evaluated against prerelease fixtures. The exact
and moving public Action references use the standalone external-consumer fixtures and verifier,
must match `package.json`, and are validated before a release tag can pass `release-check`.

Manual dispatch replays the exact and moving Action references encoded by the selected workflow
ref. To replay an older release, dispatch the workflow from that immutable version tag. A
post-publish failure never authorizes rollback or mutation of the npm version; investigate the
failed evidence and publish a forward-fix patch release.

For npm CLI smoke tests, run from a temporary directory outside this repository so npm does not
resolve the local workspace package instead of the published package:

```sh
npm exec --yes --package @0disoft/service-catalog-generator@1.0.0 -- scg --version
```

On Windows, a full install smoke test should also confirm `node_modules/.bin/scg.cmd` is created
and runs from a clean temporary project.

## Release Workflow

The release workflow runs only for `v*.*.*` tags. It validates package metadata, runs `check`, runs
a packed tarball install smoke, verifies the exact npm version is not already published, creates the
GitHub Release, conditionally moves the mutable major Action tag for stable versions, and then
publishes the scoped public package through npm Trusted Publishing. A prerelease is marked as a
GitHub prerelease, published under npm `next`, and never moves its major Action tag.

The workflow captures the previous mutable major tag target before changing release state. If a
stable workflow fails before npm publish completes, the recovery step deletes the just-created
GitHub Release and restores the previous major Action tag target, or deletes the major tag when no
previous target existed. A prerelease has no major-tag mutation to recover. Once npm publish
succeeds, recovery switches to forward-fix mode because npm package publication is immutable.

Recovery deletes a GitHub Release only when the create step emitted its run-local creation receipt.
If preflight failed because a release already existed, automation leaves that existing release
untouched. Major Action tag recovery follows the same ownership rule and runs only when the tag move
step emitted its run-local change receipt.

If npm publish returns a failure, recovery retries the public registry lookup before changing GitHub
state. Destructive rollback runs only when every lookup confirms the exact npm version is absent. A
published or uncertain registry result preserves the GitHub Release and major tag for forward-fix
review because npm publication is immutable and a lost success response is possible.

All third-party workflow Actions are pinned to immutable commit SHAs. Checkout credential
persistence is disabled; major Action tag promotion and recovery use the GitHub Git Refs API through
the tested `scripts/github-major-tag.mjs` helper and job-scoped `GITHUB_TOKEN` instead of relying on
Git credential configuration.

Release jobs are serialized across the repository, not per tag, so two patch tags cannot race while
moving the same mutable major Action tag.

The workflow must not use npm token secrets such as `NPM_PUBLISH_TOKEN`, `NPM_TOKEN`, or
`NODE_AUTH_TOKEN`. Publishing is authorized by the trusted publisher relationship for
`0disoft/service-catalog-generator/.github/workflows/release.yml` and the workflow's
`id-token: write` permission.

## Latest Verified Release

Current verified release evidence:

- npm package: `@0disoft/service-catalog-generator@1.0.1` under dist-tag `latest`.
- npm prerelease dist-tag: `next` remains `1.0.0-rc.2`.
- npm integrity:
  `sha512-6R6i0Qf0Zticydv6XinWiYQ/SybstVORpemkuti61sdjwIY0XuYXu+cAxO5rqX95M6B5E7Yzewekyqu2tt0qzA==`.
- npm provenance predicate: `https://slsa.dev/provenance/v1`.
- npm signature audit: `invalid: 0`, `missing: 0`.
- GitHub release: `v1.0.1`, published, not a draft, and not a prerelease.
- Release workflow run: `29722628054`, conclusion `success`; it created the stable GitHub Release,
  moved the major Action tag, and published npm through Trusted Publishing.
- Release commit: `cdac970ee61cd5b78f47c6a1a2e497b02a47abf8`.
- Action channels: immutable `v1.0.1` and moving `v1` resolve to the release commit; frozen `v0`
  remains on `33a0e03a67a877e8b8e9504988dbcdb657d65eaa`, the final `0.5.21` release commit.
- Published CLI smoke: clean exact-version npm installations returned `1.0.1`, generated static
  PowerShell completion, and compiled canonical v1, legacy alpha-input, and mixed fixtures with the
  expected service, edge, and diagnostic counts.
- Hosted Action smoke: workflow run `29716348297` compiled canonical v1, legacy alpha-input, mixed,
  and ZDP fixtures at the release-preparation commit.
- Released Action smoke: workflow run `29722691695` resolved the exact public
  `0disoft/service-catalog-generator@v1.0.1` tag and passed canonical v1, legacy alpha-input,
  and mixed consumer conformance on Ubuntu and Windows.
- Moving Action channel smoke: manual workflow run `29741802248` used the standalone external
  consumer kit to resolve the public `0disoft/service-catalog-generator@v1` tag and passed canonical
  v1 conformance on Ubuntu and Windows while replaying the exact `v1.0.1` consumer suite in the same
  run.
- External npm latest consumer smoke: CI workflow run `29741779881` copied the standalone kit to a
  clean temporary project, installed npm `latest`, and passed canonical v1, legacy alpha-input, and
  mixed ZDP conformance on Ubuntu and Windows.
- Hosted CI: workflow run `29722520378` passed TypeScript 7, report publication, shell completion,
  and source compatibility jobs across the declared Ubuntu, Windows, and macOS runners.
- Hosted post-publish smoke: automatic workflow run `29722691632` installed the exact stable package and
  compiled all three consumer-conformance cases on Ubuntu and Windows before release evidence.
- CodeQL: workflow run `29716348289` completed JavaScript/TypeScript and Actions analysis at the
  release-preparation commit.
- Trusted Publishing dry-run: `pnpm run release:trust:dry-run` returned publish permission for
  `0disoft/service-catalog-generator/.github/workflows/release.yml` immediately before the tag push.

## Trusted Publisher Setup and Verification

For initial setup, recovery, or relationship repair, an npm owner for the `@0disoft` scope must
authenticate locally and create the trusted publisher relationship:

```sh
npm login
npm trust github @0disoft/service-catalog-generator --file release.yml --repository 0disoft/service-catalog-generator --allow-publish
```

Use this dry-run check before creating the relationship and before pushing each release tag:

```sh
pnpm run release:trust:dry-run
```

The dry-run should report package creation or publish permission for
`0disoft/service-catalog-generator/.github/workflows/release.yml`.

If npm rejects trusted publisher creation for the current account policy, stop the release and fix
the npm package access configuration before pushing the release tag.

## Release Evidence Verification

After a release is promoted, verify the published package and GitHub release evidence:

```sh
pnpm run release-evidence -- 1.0.0
```

The command checks npm integrity, dist-tag ownership, SLSA provenance
subject/workflow/tag/commit identity, installed package signatures, the GitHub Release prerelease
flag, immutable version tag, stable-only major Action tag policy, successful release workflow run,
and published CLI version smoke.

To run the same exact-package fixture validation used by the hosted Ubuntu and Windows jobs:

```sh
pnpm run registry-smoke -- 1.0.0
```

## Stop Conditions

- Validation scripts are fake passing or unconfigured but reported as passing.
- Package metadata does not match the repository.
- npm provenance or trusted publishing setup is not understood.
- Release assets include real catalog output.
- Action tag points to a commit different from the released package commit.
- Dependency review or license policy fails.
