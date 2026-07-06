# AGENTS.md

## Repository Scope

Scope: infra

This repository owns infrastructure design contracts, environment boundaries, change plans,
drift handling, rollback decisions, and operational validation surfaces.

This repository does not generate runtime infrastructure code, credentials, cloud resources,
or deployment secrets.

## Repository Shape

Primary repository type: cli-tool
Addons: github-action, docs-site

- cli-tool: This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.
- github-action: This repository type owns action inputs, outputs, permissions, token handling, and runner compatibility.
- docs-site: This repository type owns information architecture, publishing, search, content quality, and redirects.


## Source of Truth

- Product scope: docs/product/02-spec.md
- Architecture decisions: docs/adr/*.md
- Validation: VALIDATION.md
- Agent routing: .agents/context-map.md
- Repository hygiene: .editorconfig, .gitattributes, .gitignore

## Hard Rules

- Do not generate or infer application source code from this scaffold.
- Do not invent technology choices. Use UNDECIDED when a decision is not known.
- Do not create fake credentials, tokens, secrets, or private values.
- Do not rely on generated, cache, or build output as source truth.

## Repository Hygiene

- .editorconfig sets line ending, encoding, and final newline policy.
- .gitattributes sets Git text normalization and binary diff policy.
- .gitignore excludes local, secret, build, and cache artifacts.
- Generated, cache, and build output must not be used as design-document evidence.
- Do not create large diffs that only change line endings.

## Before Editing

- Read this file, VALIDATION.md, CHECKLIST.md, and .agents/context-map.md.
- Read the skill and checklist named by the context map.
- Confirm source-of-truth documents before changing contracts.

## Out of Scope

- Application source scaffolding.
- Runtime infrastructure such as Docker, Kubernetes, Terraform, or framework apps.
- Project-specific credentials or deployment secrets.

## Final Response Requirements

- List executed validations, passed validations, skipped validations, skip reasons, and remaining risk.
- Name any source-of-truth documents changed.
- Call out API, DB, repository hygiene, and runner changes explicitly.
