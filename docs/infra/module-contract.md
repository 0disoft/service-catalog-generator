# Infrastructure Module Contract

Status: Deferred
Owner: 0disoft

## Contract

There is no infrastructure module contract in the MVP.

The repository may later contain release workflows and Action metadata, but those are packaging and
CI contracts, not infrastructure provisioning modules.

## Package Boundary

- Schema, core, CLI, report, and action packages may exist in the monorepo.
- No package may provision runtime infrastructure in the MVP.
- No package may require cloud credentials or deployment secrets in the MVP.

## Review Blockers

- A package introduces provisioning behavior without a new ADR.
- An Action or CLI path requires cloud credentials for normal catalog validation.
