# Data Integrity

Status: Draft

## Contract

Data integrity keeps the checked-in manifest as the only source of catalog truth and makes every
generated artifact reproducible from that input.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/0010-generated-artifacts-are-never-source-truth.md
- Owner: 0disoft
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Source Truth Order

1. Checked-in `service.yaml` manifests in scanned repositories.
2. `scg.config.yaml` policy and defaults.
3. Normalized `CatalogSnapshot` derived during one run.
4. Generated JSON, DOT, and HTML artifacts.

Only the first two inputs may change durable catalog facts. Generated artifacts are evidence and
presentation, not editable records.

## Deterministic Output

- Sort services by stable service id.
- Sort diagnostics by severity, file, field, and code.
- Sort dependency edges by source, target, type, and criticality.
- Preserve dependency direction and classify targets as `catalog`, `unresolved`, or `external`.
- Render graph nodes with typed keys so services, databases, queues, APIs, and external targets do
  not collapse when they share an id.
- Avoid current time in output unless explicitly represented as run metadata.
- Preserve source manifest paths without embedding full file contents.

## Staleness Policy

`metadata.lastReviewedAt` is required so stale manifest data can be diagnosed. Initial policy warns
after 90 days and may fail when configured with `--fail-on-warning`.

## Unknown Dependency Policy

Unknown service dependencies are errors by default. Users may explicitly allow unknown dependencies
for partial adoption, but output must still mark those edges as unresolved.

## Review Blockers

- A change bypasses the source of truth.
- A change weakens validation or hides skipped checks.
- A change lacks failure, recovery, security, performance, or test evidence where relevant.
- Generated output is accepted as a catalog update path.
