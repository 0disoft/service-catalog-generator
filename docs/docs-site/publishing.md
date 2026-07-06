# Publishing

Status: Draft
Repository Type: docs-site

## Repository Type Contract

This repository type owns information architecture, publishing, search, content quality, and redirects.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0008-static-report-security-boundary.md

## Required Decisions

- Docs site ownership boundary: report output is a static artifact, not a hosted portal.
- Docs site public contract: real report output is CI/internal by default; public examples must be
  synthetic.
- Docs site validation evidence: generated examples must be synthetic and deterministic.
- Docs site release or rollout policy: do not publish real catalog reports as public release assets.
- Docs site compatibility and migration policy: report format changes follow CLI JSON contract
  compatibility after 1.0.

## Publishing Boundary

The project may publish documentation about the tool and fully synthetic example reports. It must not
publish real organization service maps, dependency graphs, or generated reports by default.

Default handling:

- CI artifact: allowed for real generated reports when repository policy permits.
- Repository commit: opt-in only.
- Public release asset: synthetic examples only.

Generated reports are often sensitive because service lists and dependency graphs are operational
maps. Users should treat them as internal artifacts unless their manifests are intentionally public.

## Static Report Requirements

- No server required.
- No external scripts, fonts, images, or CDNs.
- No telemetry.
- No remote data fetch.
- Deterministic output by default.
- Safe to open from local disk or CI artifacts.

## Review Blockers

- Content structure changes break navigation or redirects.
- Publishing behavior changes without preview or link validation.
- Real catalog output is published publicly without an explicit synthetic-data or disclosure review.
