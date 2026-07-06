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
- Remaining operational risk: package availability, provenance setup, and Action runtime support must
  be reverified before first release

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
| `1.0.0` | Manifest schema and CLI contract freeze. |

Pre-1.0 breaking changes are allowed only with clear migration notes. After 1.0, manifest schema,
CLI JSON output, and exit codes are compatibility contracts.

## Release Flow

1. Confirm source-of-truth docs and ADRs are current.
2. Run configured validation commands.
3. Confirm examples and fixtures are synthetic.
4. Confirm generated reports are not published as public assets unless synthetic.
5. Confirm `package.json` repository metadata matches the public GitHub repository.
6. Use npm trusted publishing when available.
7. Create GitHub Release from the same version.
8. Move or create the corresponding Action tag.
9. Smoke test package installation and Action usage from the released tag.

## Stop Conditions

- Validation scripts are fake passing or unconfigured but reported as passing.
- Package metadata does not match the repository.
- npm provenance or trusted publishing setup is not understood.
- Release assets include real catalog output.
- Action tag points to a commit different from the released package commit.
- Dependency review or license policy fails.
