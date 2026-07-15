# Security Baseline

Status: Draft

## Contract

Security baseline covers authentication, authorization, tenant boundaries, input validation, output validation, secrets, external integrations, logs, and security blockers.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/0008-static-report-security-boundary.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Security Boundary

This project has no login server in the MVP. The security model is therefore about untrusted input
files, filesystem paths, generated outputs, CI permissions, examples, and release artifacts.

## Controls

| Risk | Required control |
| --- | --- |
| YAML bombs or oversized manifests/config | Safe parser settings, bounded config and manifest reads, manifest count limits. |
| HTML XSS | Escape every manifest-derived string before HTML output. |
| DOT injection | Escape DOT labels and reject raw DOT fragments from manifests. |
| Terminal log pollution | Strip ANSI and control characters from manifest-derived strings. |
| Secret leakage | Detect secret-like keys and values, redact where output is allowed, and fail where policy requires. |
| Tracked secret files | Run `secret-scan` in the standard `check` gate and never print matched values. |
| Real personal data in examples | Synthetic fixtures only, no real owner emails, customer names, or account IDs. |
| Vulnerability reports | Route security-sensitive reports through `SECURITY.md` without real secrets or full manifests. |
| Path traversal | Resolve real paths and reject paths outside configured roots. |
| Symlink loop | Track real paths and do not follow symlinks by default. |
| Unsafe overwrite | Write only under declared output directories and use atomic writes where practical. |
| Action permission escalation | Default to `contents: read`; write permissions require a new ADR. |
| Network exfiltration | No network calls, telemetry, remote schema fetch, or update check by default. |

## Manifest Data Rules

Manifest fields may describe data classification and ownership. They must not include customer
records, internal database endpoints, cloud account IDs, VPC/subnet IDs, credentials, private incident
channels, or real personal email addresses.

Owner references should be refs such as `team:platform` or `group:infra`, not direct email contacts.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
- A change adds network behavior, telemetry, write permissions, or real data examples without a new
  ADR.
