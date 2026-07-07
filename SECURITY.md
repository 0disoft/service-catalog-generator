# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes target the latest released minor version and the current
`main` branch.

| Version | Supported |
| --- | --- |
| `0.5.x` | Yes |
| `< 0.5.0` | No |

## Reporting a Vulnerability

Use GitHub's private vulnerability reporting or a GitHub Security Advisory for issues that could
expose secrets, execute untrusted content, write outside declared output paths, alter release
provenance, or weaken the GitHub Action permission boundary.

If private vulnerability reporting is unavailable, open a minimal public issue that says a security
report is pending, without exploit details, real secrets, private repository names, customer data, or
full manifest contents.

Expected triage:

1. A maintainer acknowledges the report or public placeholder issue.
2. The maintainer classifies the issue as package, CLI, report, GitHub Action, docs, or release
   provenance impact.
3. The fix is prepared with synthetic fixtures only.
4. The fix is validated with the standard `check` gate before release.
5. A patched npm package, GitHub Release, and Action tag are published when released behavior is
   affected.

## Security Boundaries

The MVP has no hosted service, login system, tenant model, live catalog database, telemetry backend,
or cloud discovery. Security reports should focus on repository-owned behavior:

- `service.yaml` parsing and validation.
- filesystem path handling.
- generated JSON, DOT, HTML, and terminal output.
- tracked examples, fixtures, and release assets.
- GitHub Action inputs, outputs, runtime permissions, and release provenance.

Do not include real credentials, tokens, private keys, customer data, account IDs, private repository
URLs, or confidential manifests in reports.
