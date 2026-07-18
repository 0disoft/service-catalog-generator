# Architecture

Status: Active

## Decision Summary

Service Catalog Generator is a read-only `service.yaml` compiler and linter. It runs locally or in
CI, does not perform network calls by default, and emits derived catalog artifacts that point users
back to source manifests.

## Boundary

This repository owns the local catalog generation boundary:

- input discovery for repository-owned `service.yaml` manifests;
- schema contracts for `scg.service/v1`, `scg.catalog/v1`, and `scg.config/v1`;
- manifest validation and stale-field linting;
- normalized in-memory catalog records;
- static JSON, DOT, and HTML report output;
- optional GitHub Action packaging around the same CLI behavior.

It consumes files from local working trees only. It must not become the source of truth for owners,
costs, dependencies, or data classifications; those facts remain in the manifests and upstream
systems that humans maintain.

## Runtime Flow

1. Resolve one or more scan roots from CLI arguments or config.
2. Find manifest files within allowed repository boundaries.
3. Parse each manifest into a normalized service record.
4. Validate required fields, schema shape, dependency references, and stale metadata hints.
5. Emit human-readable diagnostics and machine-readable JSON.
6. Optionally write static report artifacts and dependency graph exports.

## Package Boundaries

| Package | Owns | Must not own |
| --- | --- | --- |
| `@scg/schema` | Manifest, config, catalog snapshot, and diagnostic schemas. | File system access, CLI output, HTML generation. |
| `@scg/core` | Discovery, parsing, normalization, validation, and graph building. | Terminal output, GitHub Action API, HTML templates. |
| `@scg/cli` | Commands, flags, config precedence, output modes, and exit codes. | Duplicate validation policy. |
| `@scg/report` | JSON, DOT, and HTML writers from normalized catalog data. | Manifest parsing or external network fetches. |
| `@scg/action` | GitHub Action input/output mapping and CLI execution. | Separate validation logic or write permissions. |

## Quality Attributes

- Maintainability: changes must preserve source-of-truth documents.
- Security: manifest examples must never include real credentials, private URLs, account IDs, or
  customer data.
- Operability: report generation must be deterministic enough for CI review and easy to disable or
  clean up.
- Usefulness: generated output must make stale or missing metadata obvious instead of hiding it
  behind a polished report.

## ADRs

Current accepted decisions live in `docs/adr/0001` through `docs/adr/0010`.
