# Service Catalog Generator

Status: Pre-1.0
Scope: infra
Repository Type: cli-tool
Addons: github-action, docs-site

Service Catalog Generator is a read-only `service.yaml` compiler and linter for turning
repository-local service manifests into deterministic catalog artifacts.

The project starts from a deliberately narrow idea: each service repository owns a compact manifest,
and this tool scans those files to produce validation results, `catalog.json`, `graph.dot`, and a
static HTML report. Generated artifacts are derived output. The original truth remains the checked-in
manifest in the owning repository.

This is not a live CMDB, Backstage replacement, cloud discovery platform, permissions portal, or
service editor. Its useful edge is manifest-first validation that can run locally and in CI.

## Quick Usage

```powershell
scg scan --json
scg check --fail-on-warning
scg report --format json --format dot --format html
scg completion powershell
```

`scg report` treats its output path as a dedicated generated directory. It stages a complete report
generation, excludes concurrent SCG writers, and replaces the previous generation as a directory so
JSON, DOT, and HTML files cannot be mixed across runs. Existing directories containing files other
than SCG report artifacts are rejected instead of overwritten.

SCG manifests use `scg.service/v1alpha1` by default. Existing ZDP v2 manifests can be read through
the explicit adapter:

```powershell
scg scan --json --input-schema zdp-v2 --allow-unknown-dependencies
```

The ZDP adapter normalizes records into SCG catalog output and preserves ZDP-specific fields under
`extensions.zdp`. ZDP policy validation remains owned by `zdp-architecture-linter`.

A standalone native `scg-v1` consumer fixture with two services, strict dependency resolution, and
its own config lives under `examples/native-consumer`. Packed-package and GitHub Action smoke tests
both compile that fixture so native behavior does not depend on the ZDP adapter.

One run can compile explicitly partitioned native and ZDP roots through source-scoped config:

```powershell
scg report --config examples/mixed-consumer/scg.config.yaml
```

The mixed fixture resolves a native-to-ZDP dependency in one catalog. When `sources` is present,
put `root`, `manifestNames`, and `inputSchema` in each source and omit legacy `--root`, `--manifest`,
and `--input-schema` flags.

For a ZDP platform catalog run, materialize each repository root `service.yaml` under a temporary
manifest directory and build a derived report from that directory:

```powershell
scg report `
  --root .tmp/service-catalog/manifests `
  --input-schema zdp-v2 `
  --allow-unknown-dependencies `
  --format json `
  --format dot `
  --format html `
  --out .tmp/service-catalog/catalog
```

## Source Files

- AGENTS.md: agent working rules
- CHECKLIST.md: checklist router
- VALIDATION.md: validation names and reporting requirements
- .agents/context-map.md: agent route map
- docs/product/02-spec.md: product scope and MVP contract
- docs/compatibility/1.0-contract-matrix.md: stable, experimental, and internal surfaces
- docs/compatibility/pre-1.0-to-1.0.md: deprecation and migration policy
- docs/cli/command-contract.md: CLI command and output contract
- docs/github-action/action-contract.md: CI wrapper contract
- docs/docs-site/information-architecture.md: static report information architecture
- docs/: design, operations, architecture, and engineering standards

## Repository Shape Notes

- cli-tool: primary interface for scanning manifests, checking required fields, and exporting
  catalog artifacts.
- github-action: optional CI wrapper for running catalog validation in pull requests.
- docs-site: static HTML report generated from catalog input, not an authenticated portal.

## Implemented MVP

- Define and validate `service.yaml` v1alpha1.
- Read ZDP v2 `service.yaml` manifests through an explicit input adapter.
- Compile disjoint `scg-v1` and `zdp-v2` source roots into one catalog without schema autodetection.
- Scan one or more repositories or folders for manifests without network calls.
- Validate required owner, runtime, repository, deploy target, data, review timestamp, and
  dependency fields.
- Export service lists and dependency graphs as deterministic JSON and DOT.
- Generate a static HTML report suitable for small teams and agent workflows.
- Provide a published GitHub Action wrapper that delegates to the same CLI behavior.
- Generate Bash, Zsh, and PowerShell completion from the CLI help metadata without filesystem or
  network access.

## Explicit Non-Goals

- Replacing Backstage, OpsLevel, Cortex, or a full developer portal.
- Maintaining a live service database.
- Auto-discovering Kubernetes, Terraform, or cloud resources.
- Owning RBAC, incident management, HR ownership, or FinOps source systems.
- Treating generated reports as more authoritative than checked-in manifests.
- Inferring dependencies from source code during the MVP.

## Repository Hygiene

.editorconfig, .gitattributes, and .gitignore are generated to keep line endings,
binary diffs, local files, build outputs, caches, and secret files under control.

## Scope Notes

Confirmed implementation decisions are TypeScript, Node.js 24 LTS, pnpm workspace, npm package
distribution, CLI binary `scg`, Apache-2.0 licensing, and a root GitHub Action metadata file.
Generated real catalog reports are CI/internal artifacts by default; public examples must be
synthetic. These decisions are documented in ADRs and still require normal implementation review
before source code is introduced.
