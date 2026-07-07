import {
  CATALOG_CONFIG_SCHEMA_VERSION,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  CatalogConfigSchema,
  CatalogSnapshotSchema,
  type CatalogConfig,
  type Diagnostic
} from "@scg/schema";
import { discoverManifestFiles } from "./discovery.js";
import { sortDiagnostics, summarizeDiagnostics } from "./diagnostics.js";
import { buildGraphEdges } from "./graph.js";
import { normalizeServiceRecord, sortServiceRecords } from "./normalizer.js";
import { parseManifestFile } from "./parser.js";
import type { CatalogConfigInput, CompileCatalogOptions, CompileCatalogResult } from "./types.js";
import {
  staleReviewDiagnostic,
  unknownDependencyDiagnostics,
  validateParsedManifest
} from "./validator.js";

const DEFAULT_TOOL_VERSION = "0.5.1";
const DEFAULT_MAX_MANIFEST_BYTES = 256 * 1024;
const DEFAULT_MAX_MANIFESTS = 1000;

export async function compileCatalog(
  options: CompileCatalogOptions = {}
): Promise<CompileCatalogResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = resolveCatalogConfig(options.config);
  const discovery = await discoverManifestFiles({
    cwd,
    roots: config.scan.roots,
    manifestNames: config.scan.manifestNames,
    exclude: config.scan.exclude,
    outputDirectory: config.output.directory,
    maxManifests: options.maxManifests ?? DEFAULT_MAX_MANIFESTS,
    followSymlinks: options.followSymlinks ?? false
  });
  const diagnostics: Diagnostic[] = [...discovery.diagnostics];
  const validatedManifests = [];

  for (const discoveredManifest of discovery.manifests) {
    const parsed = await parseManifestFile(
      discoveredManifest,
      options.maxManifestBytes ?? DEFAULT_MAX_MANIFEST_BYTES
    );
    const validated = validateParsedManifest(parsed);
    if (validated.ok) {
      validatedManifests.push(validated);
    } else {
      diagnostics.push(...validated.diagnostics);
    }
  }

  const services = sortServiceRecords(
    validatedManifests.map((validated) =>
      normalizeServiceRecord(validated.manifest, validated.file.relativePath, config)
    )
  );
  const knownServiceIds = new Set(services.map((service) => service.id));

  for (const service of services) {
    const staleDiagnostic = staleReviewDiagnostic(
      service.source.path,
      service.metadata.lastReviewedAt,
      options.now ?? new Date(),
      config.validation.staleAfterDays
    );
    if (staleDiagnostic) {
      diagnostics.push(staleDiagnostic);
    }

    diagnostics.push(
      ...unknownDependencyDiagnostics(
        service.id,
        service.source.path,
        service.dependencies,
        knownServiceIds,
        config.validation.allowUnknownDependencies
      )
    );
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  const graphEdges = buildGraphEdges(services);
  const summary = summarizeDiagnostics(sortedDiagnostics);
  const snapshot = CatalogSnapshotSchema.parse({
    schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
    tool: {
      name: "service-catalog-generator",
      version: options.toolVersion ?? DEFAULT_TOOL_VERSION
    },
    summary: {
      serviceCount: services.length,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      edgeCount: graphEdges.length
    },
    services,
    diagnostics: sortedDiagnostics,
    graph: {
      edges: graphEdges
    }
  });

  return {
    config,
    snapshot,
    diagnostics: sortedDiagnostics,
    services,
    graphEdges,
    discoveredManifests: discovery.manifests
  };
}

export function resolveCatalogConfig(input: CatalogConfigInput = {}): CatalogConfig {
  const defaults = CatalogConfigSchema.parse({
    schemaVersion: CATALOG_CONFIG_SCHEMA_VERSION
  });

  return CatalogConfigSchema.parse({
    schemaVersion: input.schemaVersion ?? defaults.schemaVersion,
    scan: {
      ...defaults.scan,
      ...input.scan
    },
    validation: {
      ...defaults.validation,
      ...input.validation
    },
    output: {
      ...defaults.output,
      ...input.output
    },
    privacy: {
      ...defaults.privacy,
      ...input.privacy
    }
  });
}
