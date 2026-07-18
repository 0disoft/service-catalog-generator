import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";
import {
  CATALOG_CONFIG_SCHEMA_VERSION,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  CatalogConfigSchema,
  CatalogSnapshotSchema,
  LEGACY_CATALOG_CONFIG_SCHEMA_VERSION,
  LEGACY_SERVICE_MANIFEST_SCHEMA_VERSION,
  SERVICE_MANIFEST_SCHEMA_VERSION,
  ServiceManifestSchema
} from "../../packages/schema/src/index.js";

const manifestBody = {
  id: "migration-service",
  name: "Migration Service",
  lifecycle: "production" as const,
  owner: { type: "team" as const, ref: "platform" },
  repository: { provider: "local" as const, slug: "migration-service" },
  runtime: { language: "typescript", platform: "node" },
  deploy: {
    type: "container" as const,
    targets: [{ environment: "production", provider: "unknown", ref: "migration-prod" }]
  },
  data: { storesPersonalData: false, classification: "internal" as const },
  dependencies: [],
  metadata: { lastReviewedAt: "2026-07-01" }
};

describe("pre-1.0 schema migration", () => {
  it("normalizes alpha service and config ids to the canonical v1 values", () => {
    const legacyManifest = ServiceManifestSchema.parse({
      schemaVersion: LEGACY_SERVICE_MANIFEST_SCHEMA_VERSION,
      ...manifestBody
    });
    const canonicalManifest = ServiceManifestSchema.parse({
      schemaVersion: SERVICE_MANIFEST_SCHEMA_VERSION,
      ...manifestBody
    });
    const legacyConfig = CatalogConfigSchema.parse({
      schemaVersion: LEGACY_CATALOG_CONFIG_SCHEMA_VERSION
    });
    const canonicalConfig = CatalogConfigSchema.parse({
      schemaVersion: CATALOG_CONFIG_SCHEMA_VERSION
    });

    expect(legacyManifest).toEqual(canonicalManifest);
    expect(legacyManifest.schemaVersion).toBe(SERVICE_MANIFEST_SCHEMA_VERSION);
    expect(legacyConfig).toEqual(canonicalConfig);
    expect(legacyConfig.schemaVersion).toBe(CATALOG_CONFIG_SCHEMA_VERSION);
  });

  it.each([
    ["legacy alpha", "legacy-alpha-consumer", LEGACY_CATALOG_CONFIG_SCHEMA_VERSION, "legacy-api"],
    ["canonical v1", "native-consumer", CATALOG_CONFIG_SCHEMA_VERSION, "auth-api"]
  ] as const)("compiles %s input to a v1 catalog", async (_, fixture, schemaVersion, serviceId) => {
    const result = await compileCatalog({
      cwd: join(process.cwd(), "examples", fixture),
      config: {
        schemaVersion,
        scan: { roots: ["services"] }
      },
      now: new Date("2026-07-18T00:00:00Z")
    });

    expect(result.config.schemaVersion).toBe(CATALOG_CONFIG_SCHEMA_VERSION);
    expect(result.snapshot.schemaVersion).toBe(CATALOG_SNAPSHOT_SCHEMA_VERSION);
    expect(result.snapshot.services.map((service) => service.id)).toContain(serviceId);
    expect(result.snapshot.summary.errorCount).toBe(0);
  });

  it("does not mislabel a pre-1.0 catalog snapshot as the stable output contract", () => {
    expect(
      CatalogSnapshotSchema.safeParse({
        schemaVersion: "scg.catalog/v1alpha1",
        tool: { name: "service-catalog-generator", version: "0.5.21" },
        summary: { serviceCount: 0, errorCount: 0, warningCount: 0, edgeCount: 0 },
        services: [],
        diagnostics: [],
        graph: { edges: [] }
      }).success
    ).toBe(false);
  });
});
