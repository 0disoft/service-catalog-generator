# Output and Exit Codes

Status: Draft
Repository Type: cli-tool

## Repository Type Contract

This repository type owns command behavior, arguments, flags, config loading, exit codes, terminal output, JSON output, runtime compatibility, and shell integration contracts.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0006-diagnostics-and-exit-code-contract.md

## Required Decisions

- Command list and flag ownership: docs/cli/command-contract.md
- Exit-code taxonomy: fixed below.
- Machine-readable output contract: fixed below.
- Config precedence and default behavior: docs/cli/configuration.md.
- Runtime compatibility floor: Node.js 24 LTS.

## Exit Codes

| Code | Meaning                    |
| ---: | -------------------------- |
|    0 | Success.                   |
|    1 | Catalog validation error.  |
|    2 | CLI usage or config error. |
|    3 | Input read or parse error. |
|    4 | Output write error.        |
|    5 | Internal unexpected error. |

Warnings do not fail by default. `--fail-on-warning` promotes warning diagnostics to exit code 1.

## Diagnostic Shape

Diagnostics must include:

- `severity`: `error`, `warning`, or `info`;
- `code`: stable machine-readable code;
- `file`: manifest or config path when available;
- `field`: field path when available;
- `message`: short human explanation;
- `hint`: remediation text when available.

Initial stable diagnostic codes include:

- `manifest.missing_required_field`;
- `manifest.invalid_schema_version`;
- `manifest.invalid_yaml`;
- `dependency.unknown_target`;
- `metadata.stale_review`;
- `security.secret_like_value`;
- `path.outside_scan_root`;
- `output.write_failed`;
- `config.invalid`.

## JSON Output Shape

```json
{
  "schemaVersion": "scg.catalog/v1alpha1",
  "tool": {
    "name": "service-catalog-generator",
    "version": "0.5.3"
  },
  "summary": {
    "serviceCount": 2,
    "errorCount": 0,
    "warningCount": 1,
    "edgeCount": 1
  },
  "services": [
    {
      "id": "billing-api",
      "name": "Billing API",
      "lifecycle": "production",
      "owner": {
        "type": "team",
        "ref": "platform"
      },
      "repository": {
        "provider": "github",
        "slug": "example/billing-api"
      },
      "source": {
        "path": "services/billing-api/service.yaml"
      }
    }
  ],
  "diagnostics": [
    {
      "severity": "warning",
      "code": "metadata.stale_review",
      "file": "services/billing-api/service.yaml",
      "field": "metadata.lastReviewedAt",
      "message": "Manifest review date is older than policy.",
      "hint": "Update metadata.lastReviewedAt after verifying the service metadata."
    }
  ],
  "graph": {
    "edges": [
      {
        "source": "billing-api",
        "target": "auth-api",
        "type": "service",
        "criticality": "required"
      }
    ]
  }
}
```

JSON output must not include full manifest contents, secrets, raw stack traces, raw DOT fragments, or
unescaped HTML.

## Review Blockers

- A command changes without updating help, examples, output, and exit-code expectations.
- JSON output exposes generated or existing file contents.
- Runtime compatibility changes without smoke validation.
- A diagnostic code changes without contract-test updates and migration notes.
