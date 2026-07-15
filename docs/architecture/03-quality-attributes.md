# Quality Attributes

Status: Draft

## Source of Truth

- Product decision: docs/product/02-spec.md
- Runtime flow: docs/architecture/02-runtime-flow.md
- Security baseline: docs/engineering/04-security-baseline.md
- Testing standard: docs/engineering/05-testing-standard.md

## Determinism

- Catalog snapshots must have stable service, diagnostic, and edge ordering.
- JSON output must be deterministic by default.
- DOT output must use stable node and edge order.
- HTML report sections must be generated from the same normalized catalog as JSON and DOT.

## Security

- All manifest strings are untrusted input.
- HTML output must escape all manifest-derived text.
- DOT output must escape labels and cannot accept raw DOT fragments from manifests.
- Terminal output must strip ANSI and control characters from manifest-derived strings.
- Examples, fixtures, generated reports, and release assets must not include private URLs, account
  IDs, customer data, secrets, or real owner emails.

## CI Usability

- The CLI must return stable exit codes.
- Diagnostics must include severity, code, file, field, message, and remediation hint.
- JSON output must not embed full source file contents.
- GitHub Action behavior must delegate to CLI behavior and propagate exit status.

## Performance

Initial budgets:

- 500 manifests: under 2 seconds on a typical developer laptop.
- 500 manifests: under 5 seconds on a GitHub hosted runner.
- 1,000 manifests: bounded memory, target peak below 256 MB.
- 5,000 source declarations: schema ownership validation under 2 seconds.
- 100 real source roots and 500 mixed manifests: no looser latency budget than legacy scans.
- 1,000 mixed manifests: target peak below 256 MB.
- Aggregate manifest bytes: 64 MiB.
- Aggregate collection entries: 100,000; object depth: 32.
- Aggregate retained extension JSON: 8 MiB.
- Combined selected report output: 64 MiB.

The synthetic 1,000-service fixture currently measures 484,000 input bytes, 26,000 collection
entries, maximum depth 3, and 1,093,200 combined report bytes. Budgets may change after comparable
measurement, but performance changes must update this document and tests.

## Maintainability

- `schema` owns type contracts.
- `core` owns discovery, parse, normalize, validate, and graph construction.
- `cli` owns commands, flags, config precedence, output mode selection, and exit codes.
- `report` owns JSON, DOT, and HTML writers.
- `action` owns GitHub Action input/output mapping and CLI execution.

Validation policy must not be copied into the CLI, report writer, or GitHub Action wrapper.
