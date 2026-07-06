# Contract Source of Truth

Status: Accepted
Owner: 0disoft

## Decision

The source of truth order is:

1. Product scope and MVP behavior: `docs/product/02-spec.md`.
2. Architecture boundary: `docs/architecture/00-system-boundary.md` and this ADR set.
3. CLI behavior: `docs/cli/command-contract.md`.
4. GitHub Action wrapper behavior: `docs/github-action/action-contract.md`.
5. Static report information architecture: `docs/docs-site/information-architecture.md`.
6. Validation names and reporting contract: `VALIDATION.md`.

`service.yaml` manifests in scanned repositories are the authoritative input data for generated
catalog outputs.

## Consequences

- Generated reports cannot be edited to fix catalog facts.
- CLI, Action, and docs-site changes must trace back to the product spec or an ADR.
- Example manifests must use synthetic data and stay aligned with the schema once fixtures exist.
- Validation changes must update docs and examples in the same change.

## Review Blockers

- A behavior change updates generated examples but not the owning product or contract document.
- A CLI output change lacks corresponding documentation.
- A report structure change makes generated HTML the only place where a catalog fact is described.
