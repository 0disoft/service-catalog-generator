# Incident Response

Status: Draft

## Operational Boundary

The MVP does not own user incidents or service ownership escalation. Incident response for this
repository covers released package defects, Action defects, and accidental sensitive data exposure in
repository content or release assets.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Response Triggers

- Public fixture or release asset contains sensitive data.
- npm package or Action tag breaks documented behavior.
- Release provenance or package metadata is wrong.
- Documentation instructs users to publish real catalog reports publicly.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: sensitive data exposure blocks release
- Remaining operational risk: no formal security advisory process is configured yet
