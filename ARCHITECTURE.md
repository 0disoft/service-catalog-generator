# Architecture

Status: Draft

## Boundary

This repository owns the local catalog generation boundary:

- input discovery for repository-owned `service.yaml` manifests;
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

## Quality Attributes

- Maintainability: changes must preserve source-of-truth documents.
- Security: manifest examples must never include real credentials, private URLs, account IDs, or
  customer data.
- Operability: report generation must be deterministic enough for CI review and easy to disable or
  clean up.
- Usefulness: generated output must make stale or missing metadata obvious instead of hiding it
  behind a polished report.
