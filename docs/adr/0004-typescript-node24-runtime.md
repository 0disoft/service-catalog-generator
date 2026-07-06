# TypeScript Node 24 Runtime

Status: Accepted
Owner: 0disoft

## Decision

The implementation stack is TypeScript on Node.js 24 LTS with a pnpm workspace.

The GitHub Action wrapper should target `runs.using: node24` when `action.yml` is introduced.

## Context

The product needs strong JSON/YAML schema tooling, an npm-distributed CLI, and a GitHub Action wrapper.
TypeScript keeps the schema, CLI, package, and action ecosystem aligned without introducing a second
runtime for static report generation.

## Consequences

- Source packages should use TypeScript strict mode.
- The initial workspace should use pnpm.
- The CLI binary name is `scg`.
- Runtime support changes require smoke validation and documentation updates.
- Go, Rust, Docker, and frontend frameworks remain out of scope for the MVP unless a later ADR
  accepts them.

## Rejected Alternatives

- Go or Rust for a single binary before the npm and Action contracts exist.
- Node 26 as the runtime floor before it becomes the conservative LTS target.
- React, Next.js, Astro, or a hosted web stack for static report output.
