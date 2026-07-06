# Project Invariants

Status: Draft

## Contract

Project invariants define what must remain true across implementation, tests, docs, configuration, and release behavior.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/README.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Invariants

- The source truth is checked-in `service.yaml`, not generated output.
- The tool is read-only by default.
- Network calls and telemetry are off by default.
- CLI, Action, and report output use the same core validation behavior.
- Examples and fixtures are synthetic.
- Static HTML report output is a derived artifact, not a portal.
- Runtime direction is Node.js 24 LTS and TypeScript until a new ADR changes it.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
