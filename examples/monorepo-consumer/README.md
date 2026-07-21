# Monorepo Consumer

This synthetic consumer models one repository with separately owned `apps` and `platform` source
roots. Application manifests use `catalog.yaml`, platform manifests use `service.yaml`, and the
storefront depends on the identity service across those roots.

Run it through the public CLI after installing or building SCG:

```sh
scg report --config scg.config.yaml --json --no-color
```

The result contains `identity-api` and `storefront-api`, one resolved catalog edge, and deterministic
JSON, DOT, and HTML reports under `.catalog`. Repository validation executes the same config through
the shared consumer-conformance runner.
