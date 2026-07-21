import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  cliCommandDefinitions,
  cliExitCodes,
  cliFlagDefinitions,
  completionShells
} from "../../packages/cli/src/command-metadata.js";
import {
  CATALOG_CONFIG_SCHEMA_VERSION,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  CatalogConfigSchema,
  CatalogInputSchemaSchema,
  CatalogSnapshotSchema,
  LEGACY_CATALOG_CONFIG_SCHEMA_VERSION,
  LEGACY_SERVICE_MANIFEST_SCHEMA_VERSION,
  OwnerRefSchema,
  RepositoryRefSchema,
  RetirementSchema,
  ServiceManifestSchema,
  SERVICE_MANIFEST_SCHEMA_VERSION,
  DeploymentProfileSchema
} from "../../packages/schema/src/index.js";
import {
  DataClassificationSchema,
  DependencyCriticalitySchema,
  DependencyDirectionSchema,
  DependencyTypeSchema,
  LifecycleSchema
} from "../../packages/schema/src/shared.js";

type CompatibilityBaseline = {
  schemaVersion: string;
  contractLine: string;
  package: { name: string; bin: string; nodeMinimum: string };
  schemas: Record<string, string>;
  closedEnums: Record<string, string[]>;
  cli: { commands: string[]; flags: string[]; exitCodes: number[]; completionShells: string[] };
  configDefaults: unknown;
  manifestPaths: string[];
  catalogPaths: string[];
  diagnosticCodes: string[];
  diagnosticPaths: string[];
  reportFiles: string[];
  action: {
    runtime: string;
    main: string;
    inputs: string[];
    outputs: string[];
    inputDefaults: Record<string, string>;
  };
};

type ActionMetadata = {
  inputs: Record<string, { required?: boolean; default?: string }>;
  outputs: Record<string, unknown>;
  runs: { using: string; main: string };
};

const root = process.cwd();
const baseline = readJson("contracts/compatibility-v1.json") as CompatibilityBaseline;

describe("1.0 compatibility baseline", () => {
  it("pins package, schema, CLI, and closed-enum identities", () => {
    const packageJson = readJson("package.json") as {
      name: string;
      bin: { scg: string };
      engines: { node: string };
    };

    expect(baseline.schemaVersion).toBe("scg.compatibility-baseline/v1");
    expect(baseline.contractLine).toBe("1.x");
    expect({
      name: packageJson.name,
      bin: packageJson.bin.scg,
      nodeMinimum: packageJson.engines.node
    }).toEqual(baseline.package);
    expect(baseline.schemas).toEqual({
      service: SERVICE_MANIFEST_SCHEMA_VERSION,
      legacyServiceInput: LEGACY_SERVICE_MANIFEST_SCHEMA_VERSION,
      config: CATALOG_CONFIG_SCHEMA_VERSION,
      legacyConfigInput: LEGACY_CATALOG_CONFIG_SCHEMA_VERSION,
      catalog: CATALOG_SNAPSHOT_SCHEMA_VERSION
    });

    expect(baseline.closedEnums).toEqual({
      ownerTypes: enumOptions(OwnerRefSchema.shape.type),
      repositoryProviders: enumOptions(RepositoryRefSchema.shape.provider),
      lifecycles: enumOptions(LifecycleSchema),
      deploymentTypes: enumOptions(DeploymentProfileSchema.shape.type),
      dataClassifications: enumOptions(DataClassificationSchema),
      dependencyTypes: enumOptions(DependencyTypeSchema),
      dependencyDirections: enumOptions(DependencyDirectionSchema),
      dependencyCriticalities: enumOptions(DependencyCriticalitySchema),
      retirementStatuses: enumOptions(RetirementSchema.shape.status),
      inputSchemas: enumOptions(CatalogInputSchemaSchema),
      reportFormats: ["json", "dot", "html"]
    });
    expect(baseline.cli).toEqual({
      commands: cliCommandDefinitions.map((command) => command.name),
      flags: cliFlagDefinitions.map((flag) => flag.name),
      exitCodes: [...cliExitCodes],
      completionShells: [...completionShells]
    });
  });

  it("pins normalized defaults and observable manifest, catalog, and diagnostic fields", () => {
    const config = CatalogConfigSchema.parse({
      schemaVersion: CATALOG_CONFIG_SCHEMA_VERSION
    });
    expect(config).toEqual(baseline.configDefaults);

    const manifestInput = parse(
      readFileSync(join(root, "packages", "schema", "fixtures", "valid-full.service.yaml"), "utf8")
    ) as Record<string, unknown>;
    manifestInput.repository = {
      ...(manifestInput.repository as Record<string, unknown>),
      url: "https://example.com/billing-api"
    };
    manifestInput.retirement = { status: "planned", note: "Synthetic retirement plan." };
    manifestInput.extensions = { example: { enabled: true } };
    const manifest = ServiceManifestSchema.parse(manifestInput);
    expectPaths(manifest, baseline.manifestPaths);

    const { schemaVersion, ...serviceFields } = manifest;
    expect(schemaVersion).toBe(SERVICE_MANIFEST_SCHEMA_VERSION);
    const service = {
      ...serviceFields,
      source: { path: "services/billing-api/service.yaml" }
    };
    const snapshot = CatalogSnapshotSchema.parse({
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      tool: { name: "service-catalog-generator", version: "1.0.2" },
      summary: { serviceCount: 1, errorCount: 0, warningCount: 0, edgeCount: 1 },
      services: [service],
      diagnostics: [],
      graph: {
        edges: [
          {
            source: "billing-api",
            target: "auth-api",
            type: "service",
            criticality: "required",
            direction: "outbound",
            resolution: "external"
          }
        ]
      }
    });
    expectPaths(snapshot, baseline.catalogPaths);

    const diagnostic = {
      severity: "warning",
      code: "metadata.stale_review",
      file: "services/billing-api/service.yaml",
      field: "metadata.lastReviewedAt",
      message: "Synthetic stable diagnostic.",
      hint: "Refresh the review date."
    };
    expectPaths(diagnostic, baseline.diagnosticPaths);
  });

  it("pins stable diagnostics, report files, and Action metadata", () => {
    const matrix = readFileSync(
      join(root, "docs", "compatibility", "1.0-contract-matrix.md"),
      "utf8"
    );
    const sourceText = readSourceTree(join(root, "packages"));
    for (const code of baseline.diagnosticCodes) {
      expect(matrix, code).toContain(`\`${code}\``);
      expect(sourceText, code).toContain(`"${code}"`);
    }

    const externalManifest = readJson("conformance/external-consumer/conformance.json") as {
      cases: Array<{ reportFiles: string[] }>;
    };
    const reportFiles = [
      ...new Set(
        externalManifest.cases.flatMap((contractCase) =>
          contractCase.reportFiles.map((path) => basename(path))
        )
      )
    ];
    expect(reportFiles).toEqual(baseline.reportFiles);

    const action = parse(readFileSync(join(root, "action.yml"), "utf8")) as ActionMetadata;
    expect(action.runs).toEqual({
      using: baseline.action.runtime,
      main: baseline.action.main
    });
    expect(Object.keys(action.inputs)).toEqual(baseline.action.inputs);
    expect(Object.keys(action.outputs)).toEqual(baseline.action.outputs);
    expect(
      Object.fromEntries(
        Object.entries(action.inputs)
          .filter(([, input]) => input.default !== undefined)
          .map(([name, input]) => [name, input.default as string])
      )
    ).toEqual(baseline.action.inputDefaults);
    expect(Object.values(action.inputs).every((input) => input.required !== true)).toBe(true);
  });
});

function enumOptions(schema: { options: readonly unknown[] }): string[] {
  return schema.options.map(String);
}

function expectPaths(value: unknown, paths: string[]): void {
  for (const path of paths) {
    expect(readPath(value, path), path).not.toBeUndefined();
  }
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function readSourceTree(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return readSourceTree(path);
      }
      return entry.isFile() && entry.name.endsWith(".ts") && path.includes(`${join("", "src")}`)
        ? readFileSync(path, "utf8")
        : "";
    })
    .join("\n");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}
