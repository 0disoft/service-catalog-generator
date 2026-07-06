# GitHub Action

Status: Draft
Repository Type: github-action

## Repository Type Contract

This repository type owns action inputs, outputs, permissions, token handling, and runner compatibility.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0007-no-network-and-no-telemetry-by-default.md

## Required Decisions

- GitHub Action ownership boundary: docs/github-action/action-contract.md
- GitHub Action public contract: docs/github-action/inputs-and-outputs.md
- GitHub Action validation evidence: action input, output, permission, CLI propagation tests, and
  the `action-self-smoke` workflow.
- GitHub Action release or rollout policy: docs/ops/release.md
- GitHub Action compatibility and migration policy: Node.js 24 action runtime

## Action Boundary

The action is a CI wrapper around the CLI. It maps inputs to CLI flags, exposes summary outputs, and
propagates the CLI exit code. It must not duplicate manifest validation policy or require write
permissions by default.

## Review Blockers

- Action permission changes lack least-privilege review.
- Outputs or exit behavior changes without workflow examples.
