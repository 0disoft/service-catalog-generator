# Release and Package Provenance

Status: Accepted
Owner: 0disoft

## Decision

The project releases as npm package `@0disoft/service-catalog-generator`, CLI binary `scg`, GitHub
Release, and GitHub Action tag from one version stream.

The project should use npm trusted publishing when package metadata and repository settings are ready.
The project license is Apache-2.0.

## Context

The CLI and GitHub Action wrap the same behavior. Releasing them independently would create drift
between local, CI, and docs behavior.

## Consequences

- `package.json` repository metadata must match the public GitHub repository before publishing.
- Published package metadata must declare Apache-2.0.
- Long-lived npm tokens are not the default release path.
- Pre-1.0 breaking changes require migration notes.
- 1.0 freezes manifest schema, CLI JSON output, and exit codes.
- Release assets must not include real catalog outputs.

## Rejected Alternatives

- Separate version streams for CLI, core, report, and action during the MVP.
- Publishing from private repository settings as the primary path.
- Public release assets containing real service maps.
