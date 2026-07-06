# Service Catalog Generator

Status: Draft
Scope: infra
Repository Type: cli-tool
Addons: github-action, docs-site

Service Catalog Generator is a small, file-first tool for turning repository-local service
manifests into a static service map.

The project starts from a deliberately narrow idea: each service repository owns a compact
`service.yaml`, and this tool scans those files to produce validation results, dependency graph
exports, and a static HTML report. It is not a live CMDB, Backstage replacement, cloud discovery
platform, or permissions portal.

## Source Files

- AGENTS.md: agent working rules
- CHECKLIST.md: checklist router
- VALIDATION.md: validation names and reporting requirements
- .agents/context-map.md: agent route map
- docs/product/02-spec.md: product scope and MVP contract
- docs/cli/command-contract.md: CLI command and output contract
- docs/github-action/action-contract.md: CI wrapper contract
- docs/docs-site/information-architecture.md: static report information architecture
- docs/: design, operations, architecture, and engineering standards

## Repository Shape Notes

- cli-tool: primary interface for scanning manifests, checking required fields, and exporting
  catalog artifacts.
- github-action: optional CI wrapper for running catalog validation in pull requests.
- docs-site: static HTML report generated from catalog input, not an authenticated portal.

## MVP Direction

- Define a minimal `service.yaml` schema.
- Scan one or more repositories or folders for manifests.
- Validate required owner, runtime, repository, deploy target, data, and dependency fields.
- Export service list and dependency graph as JSON and DOT.
- Generate a static HTML report suitable for small teams and agent workflows.

## Explicit Non-Goals

- Replacing Backstage, OpsLevel, Cortex, or a full developer portal.
- Maintaining a live service database.
- Auto-discovering Kubernetes, Terraform, or cloud resources.
- Owning RBAC, incident management, HR ownership, or FinOps source systems.
- Treating generated reports as more authoritative than checked-in manifests.

## Repository Hygiene

.editorconfig, .gitattributes, and .gitignore are generated to keep line endings,
binary diffs, local files, build outputs, caches, and secret files under control.

## Scope Notes

Implementation language, package manager, runtime compatibility floor, and release packaging remain
UNDECIDED until recorded in product and ADR documents.
