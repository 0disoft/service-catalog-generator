# Dependency and Change Policy

Status: Draft

## Contract

Dependency policy covers necessity, alternatives, license, maintenance health, vulnerabilities, runtime impact, bundle impact, major upgrade policy, and removal cost.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/0009-release-and-package-provenance.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Dependency Principles

- Add a dependency only when it serves a documented contract.
- Prefer standard library or existing dependency behavior when it is enough.
- Keep runtime dependencies small because this is a CLI and GitHub Action package.
- Do not add framework dependencies for the static HTML report unless a later ADR changes the
  report boundary.
- Do not add cloud SDKs, databases, web servers, telemetry SDKs, or portal frameworks in the MVP.

## Planned Stack

| Area | Direction |
| --- | --- |
| Runtime | Node.js 24 LTS |
| Language | TypeScript strict |
| Package manager | pnpm workspace |
| Build | tsup unless implementation evidence favors another bundler |
| Test | Vitest |
| CLI parser | commander |
| YAML parser | `yaml` |
| Schema validation | Zod |
| File glob | fast-glob |
| Terminal color | picocolors |
| HTML report | Escaped string templates, no frontend framework |
| Release | Changesets and npm trusted publishing |

## Project License

Project license: Apache-2.0.

## Dependency License Policy

Allowed dependency licenses at the start:

- Apache-2.0
- MIT
- BSD-2-Clause
- BSD-3-Clause
- ISC
- BlueOak-1.0.0

Review required:

- MPL-2.0
- Any license with unclear notices, field-of-use limits, or custom terms

Blocked by default:

- GPL family
- LGPL family
- AGPL family
- SSPL family
- BUSL family
- Commons-Clause
- Elastic family licenses
- CC-BY-NC family
- NOASSERTION
- UNKNOWN

Dependency review runs through the `dependency-audit` validation in the standard `check` gate.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
- A dependency introduces a blocked license, network behavior, telemetry, or report framework drift
  without an ADR.
