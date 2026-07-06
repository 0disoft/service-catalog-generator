# Static Report Security Boundary

Status: Accepted
Owner: 0disoft

## Decision

The static report is a derived, local artifact generated from the normalized catalog snapshot.

The report must not require a server, external scripts, fonts, images, CDNs, telemetry, or remote
data fetches.

## Context

Generated service maps and dependency graphs are useful but sensitive. A static report helps small
teams browse results, but it must not become a portal or leak manifest data through unsafe rendering.

## Consequences

- Escape every manifest-derived string in HTML.
- Escape DOT labels and reject raw DOT fragments.
- Do not include full manifest contents.
- Do not publish real generated reports as public release assets.
- Generated HTML cannot be edited as a catalog source.

## Rejected Alternatives

- React, Next.js, Astro, or a hosted report app for the MVP.
- Report code reading manifests directly instead of consuming the normalized catalog.
- External assets or telemetry in generated reports.
