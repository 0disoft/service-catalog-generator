# Performance Budget

Status: Active

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
- 5,000 source declarations under 2 seconds for schema and lexical ownership validation.
- 100 disjoint real source roots and 500 mixed-adapter manifests within the same scan latency
  budgets as legacy mode.
- 1,000 mixed-adapter manifests with peak memory below 256 MB.
- No background workers, watchers, development servers, or autonomous loops in normal CLI behavior.
- No network calls or remote fetches in the default scan path.

## Measurement Rules

The standard test suite measures native and mixed 500-manifest scan budgets, native and mixed
1,000-manifest peak RSS budgets, 5,000 source declarations, and 100 real source roots through core
compiler performance tests. CI enforces the hosted-runner scan budget; local runs allow a wider
filesystem ceiling so Windows antivirus and temporary-directory overhead do not hide the
compile-path signal. Source overlap checks use hierarchy sorting plus adjacent comparisons rather
than pairwise scans. Budgets may change after implementation evidence. Any change must update this
document, quality attributes, and performance tests together.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
