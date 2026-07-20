# Pre-1.0 To 1.0 Migration Policy

Status: Accepted
Owner: 0disoft

## Upgrade Summary

1. Change new native manifests from `scg.service/v1alpha1` to `scg.service/v1`.
2. Change new config files from `scg.config/v1alpha1` to `scg.config/v1`.
3. Update consumers of complete snapshots and `catalog.json` to require `scg.catalog/v1`.
4. Regenerate reports. Do not edit generated JSON, DOT, HTML, or ownership markers by hand.
5. Test a release candidate through exact package and Action versions before adopting moving tags.

Run `pnpm run migration-check` in a source checkout to exercise the canonical and alpha compatibility
fixtures against the same v1 output assertions.

The service and config alpha ids remain accepted throughout 1.x. Their acceptance is a migration
bridge, not the canonical spelling for new files. The catalog alpha id is an output version, so 1.0
release candidates emit only `scg.catalog/v1`.

## Compatibility Window

- `scg.service/v1alpha1` and `scg.config/v1alpha1` are normalized to their `v1` ids on read.
- Removing either alpha input alias requires a 2.0 release.
- Schema selection remains explicit. Migration never introduces automatic `scg-v1` versus `zdp-v2`
  detection.
- Stable 1.x fields, accepted values, diagnostic-code meanings, exit-code meanings, Action inputs,
  Action outputs, and report filenames cannot be removed or narrowed in 1.x.
- Resource defaults may become more permissive in 1.x, but not more restrictive. Explicit limits in
  repository config remain authoritative.

## Consumer Migration

Preserve a pre-upgrade baseline with:

```console
scg check --json
```

Compare diagnostic codes, summary counts, service ids, graph edges, and report filenames. Do not
compare human prose or `.scg-*` recovery metadata because those are not public contracts.

For JSON consumers, replace an alpha-only version assertion:

```js
if (snapshot.schemaVersion !== "scg.catalog/v1") {
  throw new Error("Unsupported catalog schema");
}
```

For manifests and config, update the id in place. No field transformation is required because the
promoted v1 shapes are identical to the final pre-1.0 shapes.

## Release Channels

- Install `@0disoft/service-catalog-generator@1.0.0` for an immutable stable version or use npm
  `latest` for the current stable release. npm `next` remains the prerelease evaluation channel.
- Use `0disoft/service-catalog-generator@v1` for the moving stable Action channel or pin
  `v1.0.0`. Prereleases never move `v1` and continue to require exact tags.
- npm `latest` and Action `v1` are stable channels and move only for stable releases.
- Action `v0` remains frozen on the final 0.x release.

## Historical Pre-1.0 Changes

- `0.5.8` removed the no-op `--deterministic` flag, `validation.requireLastReviewedAt`, and
  `output.deterministic` config keys. Output remains deterministic without an opt-in setting.
- `0.5.18` added optional `validation.minimumServiceCount` with a zero default.
- `0.5.19` added optional `sources` for explicit mixed adapters. Legacy run-wide selectors remain
  supported when `sources` is absent and are rejected when source-scoped ownership is configured.
- `0.5.20` added precise config diagnostic fields. Automation must key on `config.invalid` and exit
  code 2 rather than human wording.
- `0.5.21` rejects path-like `manifestNames`, config files above 1 MiB, and adds the compatible
  `completion` command.

## Rollback

Input migration is reversible: the alpha service and config ids remain accepted during 1.x. Output
rollback means reinstalling the pinned 0.x package and regenerating reports; never rewrite a v1
snapshot to claim it is alpha. npm versions and Git tags are immutable. If a release candidate is
bad, publish a forward-fix candidate and leave stable `latest`, `v1`, and frozen `v0` untouched.
