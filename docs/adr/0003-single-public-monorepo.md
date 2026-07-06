# Single Public Monorepo

Status: Accepted
Owner: 0disoft

## Decision

Service Catalog Generator starts as one public monorepo.

The initial implementation should keep schema, core validation, CLI, static report generation,
GitHub Action wrapper, examples, tests, and release automation in this repository.

## Context

The durable contract is one product contract: read `service.yaml`, validate it, and generate
deterministic catalog artifacts. Splitting repositories before that contract stabilizes would create
version coordination work without improving the MVP.

## Consequences

- Internal packages may be separated under one workspace.
- Cross-package contracts must stay documented and tested together.
- The public repository may include schemas, validation logic, report templates, synthetic examples,
  fixtures, action code, and release workflows.
- Real service manifests, private URLs, cloud account IDs, customer data, incident channels, and real
  owner emails must not be committed.

## Rejected Alternatives

- Multiple repositories for schema, CLI, report, and action before 1.0.
- A hosted service repository with private catalog state.
