# Source-Scoped Input Adapters

Status: Implemented
Owner: 0disoft

## Purpose

Allow one catalog run to compile explicitly partitioned `scg-v1` and `zdp-v2` manifest roots
without schema autodetection, ambiguous file ownership, or separate catalogs that cannot resolve
cross-source dependencies.

## Source Of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0011-input-schema-adapters.md
- Configuration contract: docs/cli/configuration.md

## Decision

Source-scoped adapter selection is configured through an optional top-level `sources` sequence in
`scg.config.yaml`:

```yaml
schemaVersion: scg.config/v1alpha1

sources:
  - root: services
    inputSchema: scg-v1
    manifestNames:
      - service.yaml
  - root: projects/zdp-platforms
    inputSchema: zdp-v2

scan:
  exclude:
    - .git/**
    - node_modules/**
    - dist/**
    - coverage/**
    - .catalog/**
```

Each source requires a non-empty workspace-relative `root` and an explicit `inputSchema`. Supported
adapter values remain `scg-v1` and `zdp-v2`. `manifestNames` is optional and defaults to
`service.yaml`; when present, it must contain at least one non-empty filename.

`scan.exclude` remains global and is evaluated relative to each source root. Validation, resource
limits, output, and privacy settings also remain global. SCG does not add per-source policy,
resource budgets, output directories, credentials, or network behavior.

## Ownership And Path Rules

Every discovered manifest must belong to exactly one source. Before discovery, SCG resolves source
roots using the same workspace-containment and symlink policy as legacy scan roots. It rejects:

- empty `sources`;
- absolute roots or roots that resolve outside the workspace;
- duplicate roots after lexical normalization or realpath resolution;
- ancestor and descendant source roots after realpath resolution;
- symlink or junction aliases that resolve to the same or overlapping directory;
- empty `manifestNames`;
- unknown adapter values.

These conditions are configuration errors and use `config.invalid`. Declaration order never grants
precedence and never changes catalog output.

## Combined Catalog Semantics

Discovery and adapter validation are source-scoped, but normalization produces one catalog. SCG
then applies duplicate service-id isolation, dependency resolution, graph generation,
`minimumServiceCount`, aggregate resource budgets, deterministic ordering, and report publication
to the combined result exactly once.

SCG must not compile independent catalogs and concatenate their JSON. Cross-source dependencies
must resolve against the combined normalized service set.

## Legacy Mode And Precedence

When `sources` is absent, existing `scan.roots`, `scan.manifestNames`, and run-wide
`--input-schema` behavior remains unchanged.

When `sources` is present, these legacy selectors are mutually exclusive with source-scoped mode:

- explicitly configured `scan.roots`;
- explicitly configured `scan.manifestNames`;
- CLI `--root`;
- CLI `--manifest`;
- CLI `--input-schema`;
- corresponding GitHub Action `roots`, `manifest-name`, and `input-schema` inputs.

`--config`, output flags, validation-policy flags, and report format flags remain compatible. The
GitHub Action adds no serialized `sources` input; callers use the existing `config` input and omit
legacy source selectors.

Legacy mode remains supported throughout the current pre-1.0 line. Any future removal requires a
separate deprecation decision and migration window.

## Implementation Status

Runtime support is implemented in the public config schema, core source resolver, discovery
ownership metadata, CLI conflict handling, and Action-to-CLI propagation. The decision fixtures
under `tests/contract/fixtures/source-config` are enforced by contract tests. Realpath overlap,
source-order determinism, aggregate policy, cross-source dependencies, and duplicate IDs are
covered by `tests/core/source-scoped-adapters.test.ts`.

The source-scoped surface remains experimental while the package is pre-1.0. Compatibility changes
must retain the explicit adapter and disjoint-root guarantees in this ADR.

## Consequences

- Mixed native and ZDP catalogs can use explicit per-root adapters without weakening generic SCG
  ownership boundaries.
- Source-root overlap becomes a fail-closed configuration concern rather than an ordering rule.
- Global budgets and validation policy retain one meaning for the complete catalog.
- The config schema gains an experimental pre-1.0 surface that requires migration notes and
  positive plus negative fixtures before release.

## Rejected Alternatives

- Silently detect a schema from YAML shape. Similar manifests can have different policy owners.
- Encode sources in repeated CLI strings such as `--source root:schema`. Windows paths, escaping,
  and future source fields make this brittle.
- Let the first or most-specific overlapping source win. Declaration ordering would become hidden
  runtime policy.
- Compile each source independently and merge report JSON. This breaks cross-source dependency and
  duplicate-id semantics.
- Add project-specific ZDP policy to source entries. ZDP policy remains owned by
  `zdp-architecture-linter`.

## Required Validation

- Decision fixtures cover valid mixed sources and every declared static rejection rule.
- Config tests cover defaults, strict keys, legacy/source mutual exclusion, and supported adapters.
- Core tests cover lexical overlap, realpath overlap, symlink aliases, deterministic source order,
  combined duplicate IDs, and cross-source dependencies.
- CLI and Action tests cover legacy compatibility and source-selector conflicts.
- Packed CLI and hosted Action smoke use a mixed synthetic fixture before release.

## Review Blockers

- Runtime code accepts `sources` before ownership and conflict tests exist.
- A file can be owned by more than one source.
- Source declaration order affects ownership, diagnostics, services, or graph output.
- A change enables schema autodetection or duplicates ZDP policy in SCG.
- Aggregate limits or minimum service count are evaluated independently per source.
