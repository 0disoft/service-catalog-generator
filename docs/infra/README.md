# Infrastructure Notes

Status: Deferred
Owner: 0disoft

## Boundary

Service Catalog Generator is not an infrastructure module. The MVP does not own Docker, Kubernetes,
Terraform, cloud accounts, deployment environments, hosted services, or runtime provisioning.

This directory exists only to prevent future infrastructure work from bypassing the product boundary.
Infrastructure behavior requires a new ADR before implementation.

## MVP Rules

- Do not add cloud discovery.
- Do not add Terraform state discovery.
- Do not add Kubernetes discovery.
- Do not add hosted portal infrastructure.
- Do not require secrets or write permissions for the GitHub Action.
- Do not make generated reports public infrastructure assets by default.

## Review Blockers

- A change introduces infrastructure runtime behavior without a new ADR.
- A change requires credentials, cloud accounts, or deployment secrets for the MVP.
- A change treats generated catalog artifacts as deployed source truth.
