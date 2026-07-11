# Contributing

Service Catalog Generator accepts focused fixes, tests, documentation, and proposals that preserve
its read-only manifest compiler boundary. The maintainer is `@0disoft`.

## Before You Start

- Use Node.js 24 or newer and Corepack-managed pnpm 11.7.0.
- Read `AGENTS.md`, `ARCHITECTURE.md`, `VALIDATION.md`, and the source-of-truth document for the
  behavior being changed.
- Use synthetic manifests. Never submit credentials, private repository URLs, customer data, account
  identifiers, or confidential service maps.
- Discuss schema, CLI JSON, exit-code, security-boundary, or package-boundary changes in an issue
  before implementation when compatibility or ownership is unclear.

## Setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

Use `pnpm install` without `--frozen-lockfile` only when intentionally changing dependencies, and
review the resulting `package.json` and `pnpm-lock.yaml` diff together.

## Change Boundaries

- `packages/schema`: public manifest, config, diagnostic, and catalog data contracts.
- `packages/core`: discovery, parsing, normalization, validation, path policy, and graph behavior.
- `packages/cli`: commands, flags, config precedence, output, and exit codes.
- `packages/report`: deterministic JSON, DOT, and static HTML generation.
- `packages/action`: GitHub Action input/output mapping around the CLI.
- `scripts`: repository validation, release, recovery, and packaging automation.
- `docs`: product scope, ADRs, user contracts, and operating procedures.

Do not add a hosted service, live CMDB, cloud discovery, telemetry, credential storage, or network
lookup to normal catalog compilation without an accepted architecture decision.

## Validation

Use focused tests while developing, then run the complete gate before opening a pull request:

```sh
pnpm run check
```

`check` covers formatting, linting, type checking, functional and contract tests, package and Action
smoke tests, documentation, recovery, secret scanning, and dependency audit. Run `actionlint` as an
additional local check when editing `.github/workflows/*.yml` if it is installed.

GitHub Action implementation changes must rebuild and commit `dist/action/index.cjs`. The root
`dist/cli` output is a generated package artifact and is not committed.

## Pull Requests

- Keep one behavioral concern per pull request.
- Explain compatibility impact for schemas, CLI output, diagnostics, exit codes, Action inputs, and
  generated artifacts.
- Add regression coverage for bug fixes and failure-path coverage for release or security changes.
- List every validation executed and every skipped validation with its reason.
- Update `CHANGELOG.md` under `Unreleased` for user-visible or operational changes.

Only the maintainer creates release tags, GitHub Releases, moving major Action tags, or npm
publications. Contributors must not include credentials or publication tokens in changes.
