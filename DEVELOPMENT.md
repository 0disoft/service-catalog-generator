# Development

## Runtime

- Node.js: 24 or newer
- Package manager: pnpm 11.7.0 through Corepack
- Language: strict TypeScript with NodeNext modules
- Formatting: Oxfmt
- Linting: Oxlint with an explicit migrated ESLint-compatible ruleset
- Type checking and declaration emit: TypeScript 7 native `tsc`
- Compiler API and compatibility lane: TypeScript 6
- Tests: Vitest
- Bundling: tsup

The repository has no development server, database, migration runtime, or required cloud service.
Normal scan, check, report, test, and build paths must remain local and deterministic.

## Workspace Flow

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run format
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run contract
```

Run `pnpm run check` before a commit intended for review. The complete gate is intentionally broader
than unit tests because package layout, generated Action code, docs, secrets, dependencies, and
recovery behavior are part of the shipped surface.

## Where To Work

| Change | Source | Primary tests |
| --- | --- | --- |
| Manifest or config schema | `packages/schema/src` | `tests/schema`, `tests/contract` |
| Discovery, parsing, validation, graph | `packages/core/src` | `tests/core` |
| CLI arguments, output, exit codes | `packages/cli/src` | `tests/cli` |
| JSON, DOT, HTML reports | `packages/report/src` | `tests/report` |
| GitHub Action wrapper | `packages/action/src`, `action.yml` | `tests/action`, `tests/contract` |
| Release and repository automation | `scripts`, `.github/workflows` | `tests/contract`, `recovery-drill` |

Tests should use temporary directories and synthetic fixtures. Assertions must not depend on the
developer's home directory, Git credentials, private repositories, or network access unless the
test is explicitly an external release-evidence check.

## Generated Output

`pnpm run build` recreates the CLI and Action bundles. Only `dist/action/index.cjs` is tracked because
GitHub executes it directly from the repository tag. Do not edit generated bundles by hand. Version
changes must update package metadata and source version constants before rebuilding so the committed
Action bundle reports the release version.

Generated catalogs and reports belong in ignored temporary directories. They are evidence derived
from manifests, never source truth and never public fixtures unless the input is fully synthetic.

## Debugging Order

1. Reproduce with the narrowest synthetic manifest or config.
2. Confirm whether the defect belongs to schema, core, CLI, report, or Action ownership.
3. Add a failing regression test at that boundary.
4. Fix the source rather than generated output.
5. Run the focused suite, then `pnpm run check`.

Release operations and npm publication are maintainer-only procedures documented in
`docs/ops/release.md` and `docs/ops/rollback.md`.
