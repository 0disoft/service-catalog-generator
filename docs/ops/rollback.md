# Rollback

Status: Draft

## Operational Contract

Provide a short actionable decision tree with triggers, procedure, database rollback policy, validation, owners, and forward-fix criteria.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Validation

- Required validation names: smoke, docs, recovery-drill, check
- Release blocker status: rollback is required when released package, CLI, or Action tag violates a
  documented contract
- Remaining operational risk: npm unpublish windows, tag cache behavior, and downstream pinned users
  must be considered before destructive rollback

## Decision Tree

1. If a release leaks secrets, real service maps, private URLs, customer data, or account IDs, stop
   distribution first and open a security cleanup issue.
2. If the npm package is broken but the Action tag is safe, deprecate or replace the npm version and
   leave Action tags untouched.
3. If the Action tag is broken, move the major tag back to the previous good release or cut a
   forward-fix release.
4. If a schema or JSON contract break shipped without migration notes, prefer a forward-fix release
   unless the break is severe enough to block all users.

## Package Rollback

- Prefer a new patch release over unpublish when possible.
- Deprecate broken versions with a message pointing to the fixed version.
- Keep changelog and migration notes honest about pre-1.0 breaking changes.

## Action Tag Rollback

- Move `v0` or other floating major tags only after confirming the target commit is smoke-tested.
- Do not move immutable version tags except for security or release-process emergencies.
- Document the exact previous and new tag targets.

## Database Rollback

No database exists in the MVP. If a future ADR adds persistent state, this document must be rewritten
before that implementation ships.

## Forward-Fix Criteria

- The fixed release passes configured validations.
- The CLI exit code, JSON contract, and generated artifacts match docs.
- The Action tag points to the corrected commit.
- The release notes identify affected versions and user action.
- The `recovery-drill` validation passes before maintainer-executed rollback steps.
