import { describe, expect, it } from "vitest";
import {
  CATALOG_CONFIG_SCHEMA_VERSION,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  CatalogConfigSchema,
  CatalogSnapshotSchema,
  DiagnosticSchema,
  SERVICE_MANIFEST_SCHEMA_VERSION
} from "../../packages/schema/src/index.js";

describe("schema package contract", () => {
  it("exports the accepted schema version literals", () => {
    expect(SERVICE_MANIFEST_SCHEMA_VERSION).toBe("scg.service/v1alpha1");
    expect(CATALOG_SNAPSHOT_SCHEMA_VERSION).toBe("scg.catalog/v1alpha1");
    expect(CATALOG_CONFIG_SCHEMA_VERSION).toBe("scg.config/v1alpha1");
  });

  it("accepts stable diagnostic objects", () => {
    expect(
      DiagnosticSchema.safeParse({
        severity: "error",
        code: "manifest.missing_required_field",
        file: "services/auth-api/service.yaml",
        field: "owner",
        message: "Owner is required.",
        hint: "Add owner.type and owner.ref."
      }).success
    ).toBe(true);
  });

  it("applies documented config defaults", () => {
    const result = CatalogConfigSchema.parse({
      schemaVersion: "scg.config/v1alpha1"
    });

    expect(result.scan.roots).toEqual(["."]);
    expect(result.scan.manifestNames).toEqual(["service.yaml"]);
    expect(result.validation.allowUnknownDependencies).toBe(false);
    expect(result.validation.minimumServiceCount).toBe(0);
    expect(result.limits).toEqual({
      maxManifestBytes: 256 * 1024,
      maxTotalManifestBytes: 64 * 1024 * 1024,
      maxManifests: 1000,
      maxObjectDepth: 32,
      maxCollectionEntries: 100_000,
      maxExtensionBytes: 8 * 1024 * 1024,
      maxReportBytes: 64 * 1024 * 1024
    });
    expect("requireLastReviewedAt" in result.validation).toBe(false);
    expect(result.output.directory).toBe(".catalog");
    expect("deterministic" in result.output).toBe(false);
    expect(result.privacy.redactOwnerEmails).toBe(true);
  });

  it("rejects impossible minimum service count policies", () => {
    expect(
      CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1alpha1",
        validation: { minimumServiceCount: -1 }
      }).success
    ).toBe(false);
    expect(
      CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1alpha1",
        validation: { minimumServiceCount: 3 },
        limits: { maxManifests: 2 }
      }).success
    ).toBe(false);
  });

  it("accepts an empty catalog snapshot", () => {
    expect(
      CatalogSnapshotSchema.safeParse({
        schemaVersion: "scg.catalog/v1alpha1",
        tool: {
          name: "service-catalog-generator",
          version: "0.5.3"
        },
        summary: {
          serviceCount: 0,
          errorCount: 0,
          warningCount: 0,
          edgeCount: 0
        },
        services: [],
        diagnostics: [],
        graph: {
          edges: []
        }
      }).success
    ).toBe(true);
  });

  it("accepts catalog service records with namespaced extensions", () => {
    expect(
      CatalogSnapshotSchema.safeParse({
        schemaVersion: "scg.catalog/v1alpha1",
        tool: {
          name: "service-catalog-generator",
          version: "0.5.3"
        },
        summary: {
          serviceCount: 1,
          errorCount: 0,
          warningCount: 0,
          edgeCount: 0
        },
        services: [
          {
            id: "platform-runtime",
            name: "Platform Runtime",
            lifecycle: "production",
            owner: {
              type: "system",
              ref: "system:id-0disoft"
            },
            repository: {
              provider: "local",
              slug: "zdp-platform-runtime"
            },
            runtime: {
              language: "unknown",
              platform: "deployment-contracts"
            },
            deploy: {
              type: "unknown",
              targets: [
                {
                  environment: "contract",
                  provider: "zdp",
                  ref: "platform-runtime-contract"
                }
              ]
            },
            data: {
              storesPersonalData: false,
              classification: "internal"
            },
            dependencies: [],
            metadata: {
              lastReviewedAt: "2026-07-01"
            },
            extensions: {
              zdp: {
                tier: "tier2"
              }
            },
            source: {
              path: "services/platform-runtime/service.yaml"
            }
          }
        ],
        diagnostics: [],
        graph: {
          edges: []
        }
      }).success
    ).toBe(true);
  });

  it("rejects catalog snapshots whose summary counts do not match payload arrays", () => {
    expect(
      CatalogSnapshotSchema.safeParse({
        schemaVersion: "scg.catalog/v1alpha1",
        tool: {
          name: "service-catalog-generator",
          version: "0.5.3"
        },
        summary: {
          serviceCount: 1,
          errorCount: 0,
          warningCount: 0,
          edgeCount: 0
        },
        services: [],
        diagnostics: [],
        graph: {
          edges: []
        }
      }).success
    ).toBe(false);
  });
});
