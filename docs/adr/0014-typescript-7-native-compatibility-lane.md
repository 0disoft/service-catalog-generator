# TypeScript 7 Native Compatibility Lane

Status: Accepted
Owner: 0disoft

## Decision

Keep TypeScript 6.0.3 as the JavaScript compiler API and declaration-build dependency while running
TypeScript 7.0.2 as a separate native CLI compatibility gate.

The stable `typecheck` and `build` scripts invoke `node_modules/typescript/bin/tsc` explicitly. The
`typecheck-native` validation invokes `node_modules/@typescript/native/bin/tsc` explicitly and runs
on Ubuntu and Windows. Package-manager binary-link order must never decide which compiler owns a
gate.

## Context

TypeScript 7 is the stable native compiler track, but 7.0 does not provide the stable JavaScript
compiler API used by build tools. This repository also uses project references, declaration emit,
and `tsup`, so replacing the `typescript` dependency outright would combine compiler adoption with
an API-toolchain migration.

The repository already compiles cleanly with TypeScript 6.0.3. TypeScript 7.0.2 also accepts the
current project-reference and test-check configurations, so a merge-blocking comparison lane can
detect drift without silently changing the package build owner.

## Promotion Gates

TypeScript 7 may replace the TypeScript 6 build owner only after all of the following are true:

- every direct compiler API and build-tool consumer explicitly supports the selected TypeScript 7
  API track;
- project-reference builds and declaration emit remain green on Ubuntu and Windows;
- packed CLI and committed Action bundle output remain compatible;
- the full `check`, package smoke, consumer conformance, and hosted CodeQL gates pass;
- rollback restores the explicit TypeScript 6 compiler path without lockfile reconstruction.

## Consequences

- TypeScript 7 regressions block merges before they can reach release preparation.
- TypeScript 6 remains a development-only compatibility dependency and does not affect runtime or
  published package contents.
- Native platform packages are lockfile-visible optional dependencies and must resolve on supported
  CI platforms.
- A future TypeScript 7 API migration is a separate reviewed change, not an automatic consequence of
  this lane.

## Rejected Alternatives

- Let `node_modules/.bin/tsc` select a compiler. Alias installation order can change that link.
- Replace TypeScript 6 immediately. This would leave `tsup` and other API consumers without an
  explicit compatibility decision.
- Keep TypeScript 7 as a non-blocking experiment. That would allow compiler drift to accumulate
  until release preparation.
