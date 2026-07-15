# Pre-1.0 To 1.0 Migration Policy

Status: Active Pre-1.0
Owner: 0disoft

## Before Upgrading

1. Pin the current package or Action major used in CI.
2. Run `scg check --json` and preserve diagnostic codes and counts, not human prose.
3. Regenerate reports from manifests; never migrate generated artifacts by hand.
4. Remove deprecated config keys before upgrading because config parsing is strict.
5. Review changelog entries for schema ids, config defaults, resource limits, and adapter behavior.

## Change Rules

- Stable surfaces receive a changelog entry and migration note for breaking behavior. When a
  compatible transition is possible, the old form remains for at least one minor release before
  removal.
- Experimental surfaces may change before 1.0, but changes still require fixtures, changelog text,
  and explicit old-to-new guidance.
- Internal surfaces may change without migration support. Delete stale `.scg-*` recovery paths only
  after confirming no writer is active and preserving any backup needed for recovery.
- Schema selection remains explicit. Migration never introduces automatic `scg-v1` versus `zdp-v2`
  detection.

## Known Pre-1.0 Changes

- Version `0.5.8` removed the no-op `--deterministic` flag,
  `validation.requireLastReviewedAt`, and `output.deterministic` config keys. Output remains
  deterministic without an opt-in setting.
- Resource limits are configured under `limits`. Repositories exceeding a limit fail the complete
  catalog instead of emitting a partial service map.
- Report output is a dedicated generated directory. Unknown user-owned files block replacement, and
  `.scg-generation.json` is internal ownership metadata.
- Version `0.5.18` added optional `validation.minimumServiceCount`. It defaults to zero, so existing
  empty-catalog behavior is unchanged. Positive values count valid normalized services after
  duplicate-id exclusion and emit `catalog.minimum_service_count` when the policy is unmet.
- Version `0.5.19` adds optional `sources` for explicit mixed adapters. Legacy `scan.roots`,
  `scan.manifestNames`, `--root`, `--manifest`, and `--input-schema` remain supported when `sources`
  is absent, but are rejected when source-scoped ownership is configured.
- Version `0.5.20` adds precise `field`, `message`, and `hint` values to config schema diagnostics.
  Consumers should continue to key automation on `config.invalid` and exit code 2 rather than human
  wording.

## 1.0 Release-Candidate Checklist

- Replace every unresolved alpha-schema decision with a promoted schema id or an explicit
  experimental-support statement.
- Run the native consumer fixture through the packed package and released Action.
- Run the ZDP consumer catalog through the released Action.
- Record Linux and Windows installed-package evidence at the exact release commit.
- Verify that no stable input, output, diagnostic code, exit code, or report filename changed without
  a migration entry.
