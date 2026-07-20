# OpenFeature Consumer Fixture

This repository consumes the published
`@0disoft/openfeature-local-provider@1.0.0` package through the normal pnpm dependency graph.
The fixture loads `flags.json` through the provider, evaluates three boolean report-format flags
through `@openfeature/server-sdk`, and passes the enabled formats to the built SCG CLI.

The committed snapshot enables JSON and HTML and disables DOT. The consumer validation requires
`catalog.json` and `report.html`, rejects an unexpected `graph.dot`, verifies two compiled native
services, and removes the generated directory after inspection.

Run the complete repository-owned consumer path after building SCG:

```powershell
pnpm run build
pnpm run consumer-conformance
```

This fixture proves real cross-package use of the stable provider from a separate repository and a
normal registry dependency. Both repositories are maintained by `0disoft`, so this remains
owner-operated adoption evidence rather than an independent maintainer relationship.
