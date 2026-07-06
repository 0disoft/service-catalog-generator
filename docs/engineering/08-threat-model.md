# Threat Model

Status: Draft

## Contract

Threat model covers untrusted manifests, unsafe paths, generated artifacts, CI permissions, examples,
release assets, and future integration pressure.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/engineering/04-security-baseline.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Threats

| Threat | Scenario | Required mitigation |
| --- | --- | --- |
| Malicious manifest strings | Service name contains HTML, DOT syntax, ANSI, or control characters. | Escape by output target and strip terminal controls. |
| Oversized or hostile YAML | Manifest triggers parser blowup or expensive processing. | Safe parsing, size limits, count limits, parse diagnostics. |
| Secret-like values | Manifest includes token-like values, private URLs, cloud account IDs, or real emails. | Redaction, diagnostics, synthetic examples only. |
| Path traversal | Config or manifest path escapes scan root. | Normalize and reject outside-root paths. |
| Symlink loop | Scan follows cyclic links or unexpected directories. | Do not follow symlinks by default; track real paths. |
| Broad dependency scans | Discovery enters `.git`, `node_modules`, `dist`, `coverage`, or generated outputs. | Default excludes and tests. |
| Output overwrite | Report writes over source files or manifests. | Output directory allowlist and atomic writes. |
| Action escalation | Action asks for write permissions or secrets. | Default `contents: read`, new ADR for write behavior. |
| Network exfiltration | CLI fetches schemas, sends telemetry, or checks updates. | No network calls by default. |
| Generated-output trust | Teams edit HTML/JSON to fix catalog facts. | Diagnostics and docs point back to manifests only. |

## Non-Threats in MVP

The MVP has no hosted authentication, authorization, session, tenant, database, or web server
boundary. Those risks become active only if a future ADR adds hosted behavior.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
- A new integration expands the trust boundary without updating this model.
