# Inputs and Outputs

Status: Draft
Repository Type: github-action

## Repository Type Contract

This repository type owns action inputs, outputs, permissions, token handling, and runner compatibility.

## Source of Truth

- Product decision: docs/product/02-spec.md
- Technical owner: 0disoft
- Related ADR: docs/adr/0006-diagnostics-and-exit-code-contract.md

## Required Decisions

- GitHub Action ownership boundary: CLI wrapper only.
- GitHub Action public contract: draft inputs and outputs below.
- GitHub Action validation evidence: action input mapping, CLI exit propagation, and output mapping
  tests after implementation.
- GitHub Action release or rollout policy: docs/ops/release.md.
- GitHub Action compatibility and migration policy: Node.js 24 action runtime.

## Inputs

| Input                        | Required | Default         | Meaning                                                                    |
| ---------------------------- | -------- | --------------- | -------------------------------------------------------------------------- |
| `roots`                      | false    | CLI/config      | Newline or comma separated scan roots.                                     |
| `manifest-name`              | false    | CLI/config      | Manifest filename to discover.                                             |
| `input-schema`               | false    | CLI default     | Input manifest schema adapter. Supported values are `scg-v1` and `zdp-v2`. |
| `config`                     | false    | none            | Optional path to `scg.config.yaml`.                                        |
| `output-directory`           | false    | CLI/config      | Directory for generated report artifacts.                                  |
| `fail-on-warning`            | false    | CLI/config      | Promote warnings to failing validation; explicit `false` overrides config. |
| `allow-unknown-dependencies` | false    | CLI/config      | Permit unresolved refs; explicit `false` overrides config.                 |
| `report`                     | false    | `false`         | Generate report artifacts in addition to validation.                       |
| `format`                     | false    | CLI/config      | Report formats when `report` is true.                                      |

Only explicitly supplied inputs map to CLI flags. Omitted inputs defer to `scg.config.yaml` and then
CLI defaults so local and Action executions share one precedence contract.

## Outputs

| Output             | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `service-count`    | Number of normalized service records.                                |
| `error-count`      | Number of error diagnostics.                                         |
| `warning-count`    | Number of warning diagnostics.                                       |
| `report-directory` | Directory containing generated artifacts when report generation ran. |

## Exit Behavior

The action propagates the CLI exit code. It may annotate or summarize diagnostics for GitHub UI, but
the CLI result remains the contract source.
Count outputs are emitted only after the action can parse the CLI JSON summary. If the CLI produces
no parseable JSON summary, the action must fail or preserve the failing CLI status instead of
fabricating zero-count outputs.
The Action uses the CLI's bounded `--summary-json` mode and does not copy full catalog snapshots or
manifest extensions into workflow logs.

## Review Blockers

- Action permission changes lack least-privilege review.
- Outputs or exit behavior changes without workflow examples.
- Input defaults diverge from docs/cli/configuration.md.
