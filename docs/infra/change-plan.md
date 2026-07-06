# Infrastructure Change Plan

Status: Deferred
Owner: 0disoft

## Contract

Infrastructure changes are out of scope for the MVP. Any future infrastructure capability must first
update the product boundary and add an ADR.

## Required Questions

- Does the change introduce hosted runtime state?
- Does it require Docker, Kubernetes, Terraform, cloud credentials, or deployment secrets?
- Does it add network calls or telemetry?
- Does it make generated reports public by default?
- Does it change GitHub Action permissions beyond `contents: read`?

## Review Blockers

- Infrastructure behavior is added before an ADR accepts the boundary.
- The change requires secrets or write permissions not documented in GitHub Action permissions.
