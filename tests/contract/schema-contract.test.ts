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
    expect(result.output.directory).toBe(".catalog");
    expect(result.privacy.redactOwnerEmails).toBe(true);
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
});
