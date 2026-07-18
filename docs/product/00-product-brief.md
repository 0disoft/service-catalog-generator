# Product Brief

Status: Active 1.0 RC
Owner: 0disoft

## Purpose

Service Catalog Generator helps solo builders and small teams answer a basic operations question:
"what services do we own, what do they depend on, and which manifest facts are missing?"

The product is a lightweight CLI that reads checked-in `service.yaml` manifests and generates a
static catalog report. The shipped product behaves closer to `eslint` plus a static report than to a
hosted developer portal.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Boundary: read-only manifest scanner, validator, graph exporter, and static report generator.
- Data ownership: source manifests remain authoritative; generated catalog output is derived.
- Failure and recovery behavior: invalid or missing manifest fields fail validation with actionable
  diagnostics; generated reports should be reproducible from current source files.
- Validation needed before merge: VALIDATION.md

## Review Blockers

- The change turns the project into a live CMDB, SaaS portal, or cloud discovery platform without a
  new product decision.
- The change weakens validation or skips required evidence.
- The change relies on generated, cache, or build output as source truth.
