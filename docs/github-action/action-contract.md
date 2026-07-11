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
  fail-on-warning policy, unknown dependency policy, report toggle, and output format.
- GitHub Action validation evidence: action behavior must be backed by workflow examples once the
  CLI exists.
- GitHub Action release or rollout policy: npm package, GitHub Release, and Action tag share one
  version stream.
- GitHub Action compatibility and migration policy: `runs.using: node24` after implementation.

## Permission Model

The default action should require read-only repository contents access. It must not request write,
package, deployment, issue, or pull-request permissions unless a future product decision adds an
explicit publishing feature.

## Runtime Boundary

The root `action.yml` file is the public GitHub Action metadata entrypoint. The action package may
compile implementation into `packages/action/dist/index.js`, but the action must call the same CLI
behavior rather than duplicating validation logic.

## Draft Usage

```yaml
- uses: 0disoft/service-catalog-generator@v0
  with:
    roots: .
    manifest-name: service.yaml
    input-schema: scg-v1
    fail-on-warning: false
    output-directory: .catalog
```

Use `input-schema: zdp-v2` only when the checked-in manifests are ZDP v2 contracts. The action maps
the value to the CLI and must not implement a separate schema or policy layer.

## ZDP Repository Gate

A repository-local ZDP check should point `roots` at the checkout path and run before private
dependency checkout or heavier build steps:

```yaml
- name: Validate service catalog manifest
  uses: 0disoft/service-catalog-generator@v0.5.13
  with:
    roots: projects/zdp-platforms/client-surfaces/example-app
    input-schema: zdp-v2
    allow-unknown-dependencies: "true"
    fail-on-warning: "true"
```

`allow-unknown-dependencies` is appropriate at this boundary when referenced services are owned by
other repositories and are unavailable in the current checkout. It does not prove the complete
dependency graph. A central catalog run should resolve those edges across all selected manifests,
while ZDP-specific architecture policy remains owned by `zdp-architecture-linter`.

## Review Blockers

- Action permission changes lack least-privilege review.
- Outputs or exit behavior changes without workflow examples.
- Action code implements manifest validation policy outside the CLI/core path.
- Action metadata changes runtime compatibility without smoke validation.
