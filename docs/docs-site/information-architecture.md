# Information Architecture

Status: Draft
Repository Type: docs-site

## Repository Type Contract

This repository type owns information architecture, publishing, search, content quality, and redirects.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Docs site ownership boundary: generated static report for one catalog snapshot.
- Docs site public contract: service list, missing metadata summary, dependency graph, and per-service
  detail pages or sections.
- Docs site validation evidence: report output should be generated from fixtures once the CLI exists.
- Docs site release or rollout policy: UNDECIDED.
- Docs site compatibility and migration policy: UNDECIDED.

## Draft Report Structure

- Overview: service count, warning count, error count, and scan timestamp.
- Services: id, name, lifecycle, owner, repository, runtime, deploy target, and data classification.
- Dependencies: graph view and edge list.
- Gaps: missing owner, runtime, deploy target, data policy, or dependency target.
- Source: manifest path for each service record.

## Review Blockers

- Content structure changes break navigation or redirects.
- Publishing behavior changes without preview or link validation.
