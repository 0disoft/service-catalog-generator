# Generated Artifacts Are Never Source Truth

Status: Accepted
Owner: 0disoft

## Decision

Generated `catalog.json`, `graph.dot`, `report.html`, diagnostics, and screenshots are derived
artifacts. They are never accepted as the durable source of catalog facts.

## Context

The product is useful because service metadata remains close to the owning repository. If teams edit
generated reports instead of manifests, the catalog becomes another stale database.

## Consequences

- Fixes must point back to `service.yaml` or `scg.config.yaml`.
- Generated artifacts may be committed or uploaded only as policy allows, but they cannot be edited
  to change facts.
- Golden outputs are test fixtures, not production catalog sources.
- Reviewers should block changes that make report output authoritative.

## Rejected Alternatives

- HTML report editing as a lightweight catalog UI.
- JSON report patching as an integration API.
- Using generated artifacts as the only source for later scans.
