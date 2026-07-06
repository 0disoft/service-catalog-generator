# Infrastructure Drift and Rollback

Status: Deferred
Owner: 0disoft

## Contract

The MVP has no managed infrastructure, so infrastructure drift and rollback are not release blockers.
Release rollback is documented in docs/ops/rollback.md.

## Current Drift Sources

- npm package version drift.
- GitHub Action tag drift.
- Documentation contract drift.
- Generated artifact drift from source manifests.

## Review Blockers

- A change treats infrastructure drift as evidence for catalog facts.
- A change adds infrastructure rollback requirements without adding the corresponding infrastructure
  ADR.
