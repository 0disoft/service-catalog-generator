# TypeScript 7 Compiler Ownership

Status: Accepted
Owner: 0disoft

## Decision

Use TypeScript 7.0.2 as the primary compiler for type checking, project-reference builds,
declaration emit, and package builds. Keep TypeScript 6.0.3 as the JavaScript compiler API dependency
and as a separate compatibility gate.

The stable `typecheck` and `build` scripts invoke `node_modules/@typescript/native/bin/tsc`
explicitly. The `typecheck-legacy` validation invokes `node_modules/typescript/bin/tsc` explicitly
and runs on Ubuntu and Windows. Package-manager binary-link order must never decide which compiler
owns a gate.

## Context

TypeScript 7 is the stable native compiler track, but 7.0 does not provide the JavaScript compiler
API used by build tools. The native compiler can own this repository's CLI compilation while `tsup`
and other API consumers continue resolving TypeScript 6 from the direct `typescript` dependency.

The repository compiles cleanly with both TypeScript 6.0.3 and TypeScript 7.0.2. The earlier native
compatibility lane proved project-reference, declaration, packed CLI, Action bundle, consumer, and
hosted Ubuntu/Windows compatibility before this ownership change.

## Rollback

If native compilation regresses, restore the `typecheck` and `build` scripts to the explicit
`node_modules/typescript/bin/tsc` path. Both compiler packages remain locked, so rollback requires no
dependency or lockfile reconstruction. The TypeScript 7 failure must remain visible in a dedicated
gate until it is resolved.

## Consequences

- TypeScript 7 regressions block the primary build before release preparation.
- TypeScript 6 remains a development-only compiler API and compatibility dependency and does not
  affect runtime or published package contents.
- Native platform packages are lockfile-visible optional dependencies and must resolve on supported
  CI platforms.
- A future TypeScript 7 JavaScript API migration remains a separate reviewed change.

## Rejected Alternatives

- Let `node_modules/.bin/tsc` select a compiler. Alias installation order can change that link.
- Remove TypeScript 6 immediately. TypeScript 7.0 does not provide the JavaScript compiler API used
  by `tsup` and related tooling.
- Keep TypeScript 7 as only a compatibility experiment. The native lane has already satisfied the
  promotion evidence and leaving it secondary would defer the real migration indefinitely.
