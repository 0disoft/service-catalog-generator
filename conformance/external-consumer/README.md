# External Consumer Conformance Kit

This directory is a standalone synthetic consumer project. It imports no source, test helper, or
workspace package from the SCG repository. Its only runtime dependency is the public
`@0disoft/service-catalog-generator` package.

The kit covers canonical `scg.service/v1`, the supported `v1alpha1` input aliases, and a mixed
`scg-v1` plus `zdp-v2` catalog. `verify.mjs` checks stable catalog fields, graph edges, diagnostics,
report files, CLI version output, completion generation, and GitHub Action outputs.

For a human-run standalone check, copy this directory outside the repository and run the following
manual networked commands:

```sh
npm install --ignore-scripts
npm test
```

Repository automation copies the kit to a temporary directory before installation. The normal CI
job installs npm `latest`; release smoke installs the exact released version or packed tarball; and
released Action smoke uses the same fixtures and verifier with exact and moving-major Action tags.
