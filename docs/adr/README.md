# Architecture Decisions

Status: Draft
Owner: 0disoft

## Purpose

This directory records durable product and architecture decisions for Service Catalog Generator.

## Accepted ADRs

- 0001 Initial Architecture Boundaries
- 0002 Contract Source of Truth
- 0003 Single Public Monorepo
- 0004 TypeScript Node 24 Runtime
- 0005 Service Manifest Schema v1alpha1
- 0006 Diagnostics and Exit Code Contract
- 0007 No Network and No Telemetry by Default
- 0008 Static Report Security Boundary
- 0009 Release and Package Provenance
- 0010 Generated Artifacts Are Never Source Truth
- 0011 Input Schema Adapters

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Validation needed before merge: VALIDATION.md

## Review Blockers

- The change invents a product domain without a source.
- The change weakens validation or skips required evidence.
- The change relies on generated, cache, or build output as source truth.
