# Oxc Quality Toolchain

Status: Accepted
Owner: 0disoft

## Purpose

Keep local and hosted quality gates fast, deterministic, and independent from the TypeScript
compiler compatibility range of an ESLint parser stack.

## Source of Truth

- Development workflow: `DEVELOPMENT.md`
- CI validation contract: `docs/ops/ci.md`
- Validation names: `VALIDATION.md`
- Technical owner: 0disoft

## Decision

Oxfmt owns formatting for the repository's JavaScript, TypeScript, JSON, YAML, and related
configuration files. Oxlint owns non-type-aware JavaScript and TypeScript linting through an
explicit ruleset migrated from the prior ESLint and typescript-eslint recommended configurations.

TypeScript remains the authority for type checking, project-reference builds, declaration emit,
and compiler compatibility. The repository keeps the existing `tsc`-based `typecheck` and `build`
gates. Oxlint type-aware linting and `oxlint-tsgolint` are not adopted by this decision.

## Migration And Rollback

- Existing lint severities, TypeScript overrides, globals, and ignored paths remain explicit in
  `.oxlintrc.json`.
- Existing formatting options remain explicit in `.oxfmtrc.json`.
- The stable script names `format`, `format:write`, `lint`, `typecheck`, and `check` do not change.
- Rollback requires restoring the prior ESLint and Prettier dependencies, configuration files, and
  package scripts from version control; no runtime data or public package contract is involved.

## Rejected Alternatives

- Keep ESLint and typescript-eslint only to preserve the old dependency graph. This leaves lint
  execution coupled to the parser's supported TypeScript compiler range.
- Enable Oxlint type-aware linting during the tool migration. The prior configuration was not
  type-aware, so this would combine a behavior expansion with a tool replacement.
- Replace `tsc` with lint-based type checking. This would weaken evidence for declarations,
  project references, and the published build without a dedicated compatibility evaluation.

## Required Validation

- `format` passes on every declared source and configuration pattern.
- `lint` passes with warnings denied.
- `typecheck`, `test`, `contract`, `smoke`, `docs`, and the complete `check` gate remain green.
- The lockfile contains the pinned Oxfmt and Oxlint packages and no direct ESLint, Prettier, or
  typescript-eslint dependency.

## Review Blockers

- Lint or formatting scope is silently narrowed.
- Existing lint rules are dropped without an explicit compatibility decision.
- TypeScript type checking or declaration emit is removed as part of the formatter/linter change.
- A tool-generated rewrite changes runtime behavior without focused tests.
