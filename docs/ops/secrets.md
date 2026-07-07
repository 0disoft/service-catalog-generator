# Secrets

Status: Draft

## Operational Boundary

Normal CLI and GitHub Action usage requires no secrets.

## Owners

- Primary owner: 0disoft
- Backup owner: primary owner until a second maintainer is assigned
- Escalation path: repository issue or release blocker

## Rules

- Do not commit credentials, tokens, private URLs, cloud account IDs, customer data, or real owner
  emails in examples or fixtures.
- Do not require npm tokens for the default release path. Release publishing uses npm Trusted
  Publishing through GitHub OIDC.
- Local npm authentication may be used only to configure the trusted publisher relationship. It must
  not be copied into GitHub secrets, workflow files, examples, or repository docs.
- Do not expose full manifest contents in diagnostics or generated reports.
- Secret-like manifest values should produce diagnostics and redaction where output is allowed.

## Validation

- Required validation names: docs, smoke, check
- Release blocker status: secret exposure blocks release
- Remaining operational risk: automated secret scanning is not configured yet, and npm Trusted
  Publishing must be configured in npm before the first tag publish
