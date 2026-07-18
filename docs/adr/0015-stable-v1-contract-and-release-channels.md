# Stable V1 Contract And Release Channels

Status: Accepted
Owner: 0disoft

## Decision

Promote the native service manifest, repository config, and catalog snapshot to
`scg.service/v1`, `scg.config/v1`, and `scg.catalog/v1` for the 1.0 release-candidate line.

The final alpha service and config shapes are byte-for-byte field compatible with v1. Their
`v1alpha1` ids remain accepted throughout 1.x and normalize to the canonical v1 id. The catalog is
generated state: 1.0 release candidates emit only `scg.catalog/v1`, and consumers regenerate it.

Freeze the current resource defaults as 1.0 compatibility floors. A 1.x release may raise a limit
to accept more input but may not lower a default and reject workloads that the 1.0 contract accepts.
Repository owners may still configure stricter or more permissive explicit limits within the schema.

Separate prerelease and stable distribution channels. npm prereleases publish under `next`; npm
`latest` remains stable. GitHub Action prereleases use exact version tags and never create or move
the `v1` tag. The first stable 1.0 release creates `v1`; later stable 1.x releases move it only after
the complete release smoke. The `v0` tag remains frozen on the final 0.x release.

## Context

The pre-1.0 CLI, diagnostics, reports, Action, native fixture, mixed-adapter fixture, package smoke,
and registry smoke already exercise one coherent shape. Renaming fields during schema promotion
would create migration work without fixing a known contract defect. Dropping alpha inputs at the
same time would turn a spelling promotion into needless repository-wide breakage.

Release automation previously accepted only stable SemVer and always moved the derived major Action
tag. That made `1.0.0-rc.1` impossible through the supported path and risked exposing prerelease code
through npm `latest` or Action `v1`. Release-channel behavior is therefore part of the 1.0 contract,
not a late packaging detail.

## Compatibility Rules

- New manifests and configs use v1 ids.
- Alpha service and config inputs remain covered by fixtures and contract tests until 2.0.
- The complete catalog snapshot, `--json`, and `catalog.json` use `scg.catalog/v1`.
- Stable core fields may gain optional fields in 1.x but cannot be removed, renamed, narrowed, or
  repurposed.
- Unknown manifest and config keys remain errors; v1 does not turn strict schemas into open maps.
- `extensions.<namespace>` and normalized `extensions.zdp` remain explicitly experimental without
  weakening stable core fields.
- Resource-limit errors and keys stay stable. Default-limit reductions are breaking.
- Exact prerelease tags are immutable; moving major tags are stable-only channels.

## Rejected Alternatives

- Keep every alpha id in 1.0. This would ship a major release without a stable data contract.
- Reject all alpha inputs immediately. The schema shape did not change, so the break would buy no
  safety and would punish existing repositories for an identifier-only promotion.
- Continue emitting the alpha catalog id. Generated output is the cleanest boundary to promote and
  retaining two output ids would make one shape appear to have two current meanings.
- Publish prereleases to npm `latest` or move Action `v1`. Moving channels imply stable adoption and
  would make rollback ambiguous for consumers who did not select a prerelease.
- Lower resource defaults when benchmarks change. A lower default turns previously valid input into
  an error and is a major compatibility break.

## Consequences

- Existing alpha manifests and configs continue to compile, but normalized config and adapted
  manifest values report canonical v1 ids.
- JSON consumers must update their schema-version assertion before adopting the release candidate.
- Release evidence must verify npm dist-tags, GitHub prerelease state, exact tags, and the absence of
  prerelease movement on `v1`.
- A future removal of alpha input aliases is explicitly a 2.0 decision.
