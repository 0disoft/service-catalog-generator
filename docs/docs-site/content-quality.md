# Content Quality

Status: Draft
Repository Type: docs-site

## Repository Type Contract

This repository type owns information architecture, publishing, search, content quality, and redirects.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0008-static-report-security-boundary.md

## Required Decisions

- Docs site ownership boundary: static generated report only.
- Docs site public contract: summary, services, diagnostics, dependencies, and source sections.
- Docs site validation evidence: golden output tests and link/content checks after implementation.
- Docs site release or rollout policy: generated reports are not public release assets unless fully
  synthetic.
- Docs site compatibility and migration policy: schema and report structure changes need migration
  notes before 1.0 freeze.

## Content Rules

- Show catalog facts from the normalized snapshot, not from re-reading manifests.
- Prioritize diagnostics, missing metadata, and dependency edges over visual decoration.
- Include source manifest paths for repair workflows.
- Do not include full manifest contents.
- Do not include private URLs, cloud account IDs, customer names, real owner emails, incident
  channels, or secret-like values.
- Explain each diagnostic with a fix hint where possible.

## Review Blockers

- Content structure changes break navigation or redirects.
- Publishing behavior changes without preview or link validation.
- Generated HTML becomes the only place where a catalog fact is described.
