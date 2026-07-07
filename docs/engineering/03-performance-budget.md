# Performance Budget

Status: Draft

## Contract

Performance budgets track scan latency, generated output size, memory, package/action bundle size,
and avoided background work.

## Required Evidence

- Source of truth: docs/architecture/03-quality-attributes.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Initial Budgets

- 500 manifests under 2 seconds on a typical developer laptop.
- 500 manifests under 5 seconds on a GitHub hosted runner.
- 1,000 manifests with peak memory below 256 MB as an initial target.
- No background workers, watchers, development servers, or autonomous loops in normal CLI behavior.
- No network calls or remote fetches in the default scan path.

## Measurement Rules

The standard test suite measures the 500-manifest hosted-runner scan budget through a core compiler
performance test. Budgets may change after implementation evidence. Any change must update this
document, quality attributes, and performance tests together.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
