# Permissions

Status: Draft
Repository Type: github-action

## Repository Type Contract

This repository type owns action inputs, outputs, permissions, token handling, and runner compatibility.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0007-no-network-and-no-telemetry-by-default.md

## Required Decisions

- GitHub Action ownership boundary: read repository files and run CLI behavior.
- GitHub Action public contract: no write permission required by default.
- GitHub Action validation evidence: permission assumptions covered by action tests and workflow
  examples after implementation.
- GitHub Action release or rollout policy: docs/ops/release.md.
- GitHub Action compatibility and migration policy: Node.js 24 action runtime.

## Default Permissions

Recommended workflow permissions:

```yaml
permissions:
  contents: read
```

The action must not require:

- `contents: write`;
- `issues: write`;
- `pull-requests: write`;
- `packages: write`;
- `deployments: write`;
- repository secrets.

## Token Handling

The action should not read `GITHUB_TOKEN` directly unless required by GitHub Action runtime behavior.
It must not send repository contents, manifest contents, diagnostics, or generated reports to a
network service.

## Escalation Rule

Any future feature requiring write permissions, external API calls, artifact publishing beyond the
local workflow workspace, or secrets requires a new ADR before implementation.

## Review Blockers

- Action permission changes lack least-privilege review.
- Outputs or exit behavior changes without workflow examples.
- Action behavior depends on a secret or write permission without a new ADR.
