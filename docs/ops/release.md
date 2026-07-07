# Release

Status: Draft

## Operational Contract

Cover release types, versioning, pre-release checklist, deployment flow, post-deploy verification, stop conditions, and owner handoff.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Validation

- Required validation names: format, lint, typecheck, test, contract, smoke, docs, check
- Release blocker status: any missing implemented validation is a blocker unless documented as not
  yet configured
- Remaining operational risk: package availability, Trusted Publishing, and Action runtime support
  are verified for `0.5.2`; each future release must reverify the same evidence before promotion

## Release Units

- npm package: `@0disoft/service-catalog-generator`.
- CLI binary: `scg`.
- GitHub Release: same version as npm.
- GitHub Action tag: same major stream as npm, for example `v0`.

## Version Plan

| Version | Scope |
| --- | --- |
| `0.1.0` | Schema, fixtures, docs, empty CLI skeleton. |
| `0.2.0` | `scan`, `check`, JSON diagnostics. |
| `0.3.0` | DOT export and static HTML report. |
| `0.4.0` | GitHub Action wrapper. |
| `0.5.0` | Security hardening, deterministic output, docs polish. |
| `0.5.1` | Trusted Publishing release validation. |
| `0.5.2` | npm bin metadata normalization. |
| `1.0.0` | Manifest schema and CLI contract freeze. |

Pre-1.0 breaking changes are allowed only with clear migration notes. After 1.0, manifest schema,
CLI JSON output, and exit codes are compatibility contracts.

## Release Flow

1. Confirm source-of-truth docs and ADRs are current.
2. Run configured validation commands.
3. Confirm examples and fixtures are synthetic.
4. Confirm generated reports are not published as public assets unless synthetic.
5. Confirm `package.json` repository metadata matches the public GitHub repository.
6. Push an immutable `vX.Y.Z` tag that exactly matches `package.json.version`.
7. Use the `release` workflow to publish through npm Trusted Publishing and GitHub OIDC.
8. Create the GitHub Release from the same version tag.
9. Move or create the corresponding major Action tag, such as `v0`.
10. Smoke test package installation and Action usage from the released tag.

For npm CLI smoke tests, run from a temporary directory outside this repository so npm does not
resolve the local workspace package instead of the published package:

```sh
npm exec --yes --package @0disoft/service-catalog-generator@0.5.2 -- scg --version
```

On Windows, a full install smoke test should also confirm `node_modules/.bin/scg.cmd` is created
and runs from a clean temporary project.

## Release Workflow

The release workflow runs only for `v*.*.*` tags. It validates package metadata, runs `check`, runs
`pnpm pack --dry-run`, publishes the scoped public package through npm Trusted Publishing, creates
the GitHub Release, and moves the mutable major Action tag.

The workflow must not use npm token secrets such as `NPM_PUBLISH_TOKEN`, `NPM_TOKEN`, or
`NODE_AUTH_TOKEN`. Publishing is authorized by the trusted publisher relationship for
`0disoft/service-catalog-generator/.github/workflows/release.yml` and the workflow's
`id-token: write` permission.

## Latest Verified Release

Current verified release evidence:

- npm package: `@0disoft/service-catalog-generator@0.5.2`.
- GitHub Release: `v0.5.2`.
- Release workflow run: `28838627667`, conclusion `success`.
- Release commit: `9d92d6b79030f5fda6c2700cca25b2d51a5abdd6`.
- Mutable Action tag: `v0` points to the `0.5.2` release commit.
- Published CLI smoke: `npm exec --yes --package @0disoft/service-catalog-generator@0.5.2 -- scg --version` returned `0.5.2`.
- Windows install smoke: `node_modules/.bin/scg.cmd --version` returned `0.5.2` from a clean
  temporary project.
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

## Stop Conditions

- Validation scripts are fake passing or unconfigured but reported as passing.
- Package metadata does not match the repository.
- npm provenance or trusted publishing setup is not understood.
- Release assets include real catalog output.
- Action tag points to a commit different from the released package commit.
- Dependency review or license policy fails.
