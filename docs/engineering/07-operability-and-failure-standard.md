# Operability and Failure Standard

Status: Draft

## Contract

Operability standard connects CLI behavior, CI behavior, release behavior, rollback, diagnostics,
failure evidence, and user repair paths.

## Required Evidence

- Source of truth: docs/cli/output-and-exit-codes.md and docs/ops/rollback.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Failure Evidence

- CLI failures must map to stable exit codes.
- Diagnostics must include enough path and field context for a user or agent to repair the manifest.
- Internal errors must not dump full manifest contents or secrets.
- Action failures must preserve CLI exit behavior.
- Report-generation failures must avoid partial or unsafe output overwrite where practical.

## Operability Boundary

The MVP has no hosted service, database, background worker, dashboard, or incident workflow. Runtime
operability is therefore about local command behavior, CI reproducibility, and release rollback.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
