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

## Security Advisory Path

Security-sensitive reports follow `SECURITY.md`. Reports should use GitHub private vulnerability
reporting or GitHub Security Advisories when available. If those channels are unavailable, the
public placeholder issue must omit exploit details, real secrets, private repository names, customer
data, and full manifest contents.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: sensitive data exposure blocks release
- Remaining operational risk: `SECURITY.md` defines the advisory process; GitHub repository-level
  private vulnerability reporting settings still need maintainer-side confirmation.
