## Summary

## Boundary

Which schema, core, CLI, report, Action, documentation, or release boundary owns this change?

## Compatibility

Describe changes to manifests, config, diagnostics, CLI output, exit codes, Action inputs/outputs,
package contents, or generated artifacts. Write `None` when these contracts are unchanged.

## Risk And Recovery

## Validation

- [ ] Focused regression tests
- [ ] `pnpm run check`
- [ ] `actionlint` when workflows changed

Skipped validation and reason:

## Checklist

- [ ] Fixtures and examples are synthetic and contain no secrets or private catalog data.
- [ ] User-visible or operational changes are recorded under `CHANGELOG.md` `Unreleased`.
- [ ] Generated `dist/action/index.cjs` is rebuilt when Action implementation changed.
- [ ] The change stays inside SCG's read-only compiler and static-report boundary.
