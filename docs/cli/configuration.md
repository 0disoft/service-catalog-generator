# CLI Configuration

Status: Stable Pre-1.0
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0006-diagnostics-and-exit-code-contract.md

## Required Decisions

- Command list and flag ownership: docs/cli/command-contract.md
- Exit-code taxonomy: docs/cli/output-and-exit-codes.md
- Machine-readable output contract: docs/cli/output-and-exit-codes.md
- Config precedence and default behavior: CLI flags, config file, defaults.
- Runtime compatibility floor: Node.js 24 LTS.

## Config File

The default config filename is `scg.config.yaml`.

```yaml
schemaVersion: scg.config/v1alpha1

scan:
  roots:
    - .
  manifestNames:
    - service.yaml
  exclude:
    - .git/**
    - node_modules/**
    - dist/**
    - coverage/**
    - .catalog/**

validation:
  failOnWarnings: false
  allowUnknownDependencies: false
  staleAfterDays: 90
  minimumServiceCount: 0

limits:
  maxManifestBytes: 262144
  maxTotalManifestBytes: 67108864
  maxManifests: 1000
  maxObjectDepth: 32
  maxCollectionEntries: 100000
  maxExtensionBytes: 8388608
  maxReportBytes: 67108864

output:
  directory: .catalog
  formats:
    - json
    - dot
    - html

privacy:
  redactRepositoryUrls: false
  redactOwnerEmails: true
```

## Precedence

1. CLI flags.
2. `scg.config.yaml` or file passed through `--config`.
3. Built-in defaults.

Environment variables must not override catalog semantics. `NO_COLOR` may affect terminal color and
`CI` may affect human-output defaults, but neither may change validation policy.

## Defaults

- Root: current working directory.
- Manifest name: `service.yaml`.
- Scan excludes: POSIX-style glob patterns matched against paths relative to each scan root.
  `services/legacy/**` excludes only that subtree, not sibling manifests under `services/`.
- Input schema: `scg-v1`; use `--input-schema zdp-v2` for ZDP v2 manifests.
- Output directory: `.catalog`.
  When the configured output directory resolves below a scan root, only that generated subtree is
  skipped during discovery. The directory is owned as one generated report set: each successful
  `report` run replaces the complete prior generation, removes report formats not selected by the
  new run, and writes `.scg-generation.json` as internal publication metadata. Use a dedicated path;
  SCG rejects an existing directory containing non-SCG entries and never uses the workspace root.
- Formats: JSON for `scan`, no write for `check`, JSON/DOT/HTML for `report`.
- Unknown dependencies: failing diagnostic by default.
- Warnings: non-failing unless `--fail-on-warning` is set.
- Minimum service count: `0`. Set `validation.minimumServiceCount` to a non-negative integer when a
  catalog must contain at least that many valid, uniquely identified normalized services. The value
  cannot exceed `limits.maxManifests`.
- Resource limits: fail closed before publishing a partial catalog. Limits cover each manifest,
  aggregate input bytes, manifest count, object depth, aggregate collection entries, aggregate
  retained extensions, and the combined selected report formats.
- Determinism: JSON, DOT, and report outputs are always sorted for stable CI diffs; this is not a
  configurable mode.
- Network calls: none.
- Telemetry: none.

## Resource Budget Evidence

The default limits preserve the existing 1,000-manifest scan contract. The maintained synthetic
1,000-service fixture measures 484,000 input bytes, 26,000 collection entries, maximum object depth
3, and 1,093,200 combined JSON/DOT/HTML report bytes. The defaults leave headroom for richer
manifests while stopping inputs that approach the previous theoretical 256 MiB aggregate file cap.

Limit increases are explicit capacity decisions. Reducing a limit can make an existing repository
fail validation and should be rolled out with measured consumer evidence.

`minimumServiceCount` is validation policy rather than a discovery limit. SCG evaluates it after
manifest validation, normalization, and duplicate-id exclusion. A shortfall emits
`catalog.minimum_service_count` and exit code 1. Keeping the default at zero preserves intentional
empty-repository validation.

## Migrating From Removed No-Op Settings

Version `0.5.8` removed the legacy no-op `--deterministic` flag and these config keys:

- `validation.requireLastReviewedAt`
- `output.deterministic`

Catalog JSON, DOT, and HTML outputs are always deterministic, so there is no opt-in
deterministic mode to configure. `metadata.lastReviewedAt` remains required by the service
manifest schema; the config file cannot disable that schema requirement.

Remove those keys from old `scg.config.yaml` files before upgrading. The config parser is strict,
so keeping removed keys is treated as an invalid config instead of being silently ignored.

## Review Blockers

- A new config field bypasses the documented precedence order.
- A config value enables network calls, telemetry, or auto-discovery without a new ADR.
- A config default scans generated, dependency, cache, or VCS directories.
- A config default can overwrite source manifests or root repository files.
