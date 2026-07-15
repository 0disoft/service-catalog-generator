# Release

Status: Draft

## Operational Contract

Cover release types, versioning, pre-release checklist, deployment flow, post-deploy verification, stop conditions, and owner handoff.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Validation

- Required validation names: format, lint, typecheck, test, contract, smoke, docs, recovery-drill,
  release-evidence, registry-smoke, check
- Release blocker status: any missing implemented validation is a blocker unless documented as not
  yet configured
- Remaining operational risk: package availability, Trusted Publishing, and Action runtime support
  are verified for `0.5.19`; each future release must rerun `release-evidence` and reverify Trusted
  Publishing before promotion

## Release Units

- npm package: `@0disoft/service-catalog-generator`.
- CLI binary: `scg`.
- GitHub Release: same version as npm.
- GitHub Action tag: same major stream as npm, for example `v0`.

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
7. Push an immutable `vX.Y.Z` tag that exactly matches `package.json.version`.
8. Use the `release` workflow to create the GitHub Release.
9. Move or create the corresponding major Action tag through the workflow, then publish through npm
   Trusted Publishing and GitHub OIDC.
10. If the workflow fails before npm publish completes, confirm the automatic recovery step removed
   the GitHub Release and restored or deleted the mutable major Action tag.
11. If npm publish succeeds but downstream evidence later fails, treat the package as immutable and
   cut a forward-fix patch release rather than trying to rewrite the published version.
12. Smoke test package installation and Action usage from the released tag.
13. Run `pnpm run release-evidence -- <version>` after promotion.

After a successful `release` workflow, `release-smoke` installs the exact published npm version on
Ubuntu and Windows and compiles the native consumer fixture. The evidence job runs only after both
registry smoke jobs pass, then verifies npm provenance and signatures, the GitHub Release, the
immutable version tag, the mutable major Action tag, and the originating release workflow. Registry
visibility is retried for up to 60 seconds before the smoke fails.

The workflow also supports a manual `version` input, with or without a `v` prefix, for replaying
evidence against an existing release. A post-publish failure never authorizes rollback or mutation
of the npm version; investigate the failed evidence and publish a forward-fix patch release.

For npm CLI smoke tests, run from a temporary directory outside this repository so npm does not
resolve the local workspace package instead of the published package:

```sh
npm exec --yes --package @0disoft/service-catalog-generator@0.5.19 -- scg --version
```

On Windows, a full install smoke test should also confirm `node_modules/.bin/scg.cmd` is created
and runs from a clean temporary project.

## Release Workflow

The release workflow runs only for `v*.*.*` tags. It validates package metadata, runs `check`, runs
a packed tarball install smoke, verifies the exact npm version is not already published, creates the
GitHub Release, moves the mutable major Action tag, and then publishes the scoped public package
through npm Trusted Publishing.

The workflow captures the previous mutable major tag target before changing release state. If the
workflow fails before npm publish completes, the recovery step deletes the just-created GitHub
Release and restores the previous major Action tag target, or deletes the major tag when no previous
target existed. Once npm publish succeeds, recovery switches to forward-fix mode because npm package
publication is treated as immutable.

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

- npm package: `@0disoft/service-catalog-generator@0.5.19`.
- npm integrity:
  `sha512-3ewftmKEZ+RWxHDtis/a2aeZixXR8guWjxGyZzS4uR6uDx3jSObfa6JeIR9BYPNDyTE151bwc4a6P0spEJBmgg==`.
- npm provenance predicate: `https://slsa.dev/provenance/v1`.
- npm signature audit: `invalid: 0`, `missing: 0`.
- GitHub Release: `v0.5.19`.
- Release workflow run: `29389217448`, conclusion `success`.
- Release commit: `0cb972bf662b285b5a8ba9ccdbfb75105c80ab6e`.
- Mutable Action tag: `v0` points to the `0.5.19` release commit.
- Published CLI smoke: clean npm installation created `node_modules/.bin/scg.cmd` and returned
  `0.5.19`.
- Windows install smoke: clean temporary npm install created `node_modules/.bin/scg.cmd`, returned
  `0.5.19`, and compiled the native consumer fixture as 2 services, 1 edge, and 0 errors.
- Published mixed-consumer smoke: a clean exact-version install compiled one native and one ZDP
  service as 2 services, 1 cross-source edge, and 0 errors.
- Hosted Action smoke: workflow run `29389165146` compiled the mixed source-scoped fixture at the
  release commit with 2 services, 1 cross-source edge, and 0 errors.
- Hosted post-publish smoke: automatic workflow run `29389264610` installed and compiled the exact
  `0.5.19` package on Ubuntu and Windows before the release-evidence job succeeded.
- CodeQL: workflow run `29389165164` completed JavaScript/TypeScript and Actions analysis at the
  release commit.
- Trusted Publishing dry-run: `pnpm run release:trust:dry-run` returned publish permission for
  `0disoft/service-catalog-generator/.github/workflows/release.yml`.

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
pnpm run release-evidence -- 0.5.19
```

The command checks npm integrity, SLSA provenance subject/workflow/tag/commit identity, installed
package signatures, the GitHub Release, immutable version tag, mutable major Action tag, successful
release workflow run, and published CLI version smoke.

To run the same exact-package fixture validation used by the hosted Ubuntu and Windows jobs:

```sh
pnpm run registry-smoke -- 0.5.19
```

## Stop Conditions

- Validation scripts are fake passing or unconfigured but reported as passing.
- Package metadata does not match the repository.
- npm provenance or trusted publishing setup is not understood.
- Release assets include real catalog output.
- Action tag points to a commit different from the released package commit.
- Dependency review or license policy fails.
