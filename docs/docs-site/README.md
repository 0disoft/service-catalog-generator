# Docs Site

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
- Docs site public contract: docs/docs-site/information-architecture.md
- Docs site validation evidence: golden report output tests from synthetic fixtures.
- Docs site release or rollout policy: docs/docs-site/publishing.md
- Docs site compatibility and migration policy: report output follows normalized catalog contracts.

## Report Boundary

The docs-site addon represents generated static HTML output. It is not a hosted portal, editor,
login surface, RBAC system, or live catalog database.

## Review Blockers

- Content structure changes break navigation or redirects.
- Publishing behavior changes without preview or link validation.
