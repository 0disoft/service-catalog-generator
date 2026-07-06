# Environments

Status: Deferred
Owner: 0disoft

## Contract

The MVP has no hosted runtime environments.

Supported execution environments are local developer workspaces and GitHub Actions runners. Both run
the CLI against checked-in manifests and generated local artifacts.

## Non-Goals

- Cloud deployment environments.
- Kubernetes clusters.
- Terraform workspaces.
- Hosted databases.
- Long-running servers.
- Background workers.

## Review Blockers

- A change requires hosted infrastructure before an ADR accepts that boundary.
- A change changes catalog semantics based on environment variables rather than documented config.
