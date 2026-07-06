# Code Review Checklist

Status: Draft

## Contract

Code review blockers include ownership drift, hidden auth or tenant rules, untested failure paths, contract drift, fake validation success, and generated-output dependency.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/README.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Checklist

- Source-of-truth docs changed with behavior changes.
- Manifest schema changes include fixtures and validation evidence.
- CLI changes include help, JSON output, exit-code, and config documentation updates.
- Report changes escape HTML and DOT output and do not read manifests directly.
- Action changes delegate to CLI behavior and keep default permissions read-only.
- Generated artifacts are not treated as source truth.
- Examples and fixtures contain no real internal data.
- New dependencies satisfy the license and change policy.
- Skipped validations are named with reasons and remaining risk.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
