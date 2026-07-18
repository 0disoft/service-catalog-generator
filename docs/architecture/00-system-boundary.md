# System Boundary

Status: Active

## Boundary

This repository owns read-only catalog generation from checked-in service manifests.

Owned:

- manifest discovery below configured scan roots;
- `service.yaml` schema and validation behavior;
- normalized catalog model;
- missing-field and stale-field diagnostics;
- JSON, DOT, and static HTML output contracts;
- optional GitHub Action wrapper for CI use.

Not owned:

- live service inventory state;
- cloud, Kubernetes, Terraform, or source-code auto-discovery;
- ownership truth outside the manifest;
- cost accounting systems;
- incident, RBAC, or developer portal workflows.

## Runtime Flow

CLI input -> scan roots -> manifest files -> parser -> validator -> normalized catalog -> diagnostics
and optional output writers.

## Quality Attributes

- Maintainability: schema, fixtures, docs, and generated examples must stay synchronized.
- Security: examples and reports must not include real credentials, private account ids, customer
  identifiers, or secret-like fields.
- Operability: CI mode must be deterministic and produce enough evidence to fix stale manifests.
- Performance: scanning should avoid broad ignored directories and large generated outputs by
  default.
