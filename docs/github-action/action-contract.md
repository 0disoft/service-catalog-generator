# Action Contract

Status: Draft
Repository Type: github-action

## Repository Type Contract

This repository type owns action inputs, outputs, permissions, token handling, and runner compatibility.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- GitHub Action ownership boundary: wrap the CLI for pull-request validation and optional static
  report artifact generation.
- GitHub Action public contract: inputs should name scan roots, manifest filename, output directory,
  and fail-on-warning policy; exact input names remain draft.
- GitHub Action validation evidence: action behavior must be backed by workflow examples once the
  CLI exists.
- GitHub Action release or rollout policy: UNDECIDED.
- GitHub Action compatibility and migration policy: UNDECIDED.

## Permission Model

The default action should require read-only repository contents access. It must not request write,
package, deployment, issue, or pull-request permissions unless a future product decision adds an
explicit publishing feature.

## Review Blockers

- Action permission changes lack least-privilege review.
- Outputs or exit behavior changes without workflow examples.
