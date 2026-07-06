# No Network and No Telemetry by Default

Status: Accepted
Owner: 0disoft

## Decision

The CLI, core engine, report generator, and GitHub Action perform no network calls, telemetry,
remote schema fetches, or automatic update checks by default.

## Context

Service manifests and generated catalog reports can reveal organization structure, service names,
dependency graphs, private repositories, and data classification. The safest default for a catalog
linter is local-only execution.

## Consequences

- Schema validation uses local schemas.
- Examples and fixtures are synthetic.
- Action behavior cannot require secrets or write permissions.
- Future opt-in network behavior requires a new ADR and security review.

## Rejected Alternatives

- Remote schema fetch by default.
- Telemetry collection for CLI usage.
- Automatic update checks.
- Uploading generated reports to an external service.
