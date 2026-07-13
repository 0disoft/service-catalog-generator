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
import { serializedByteLength } from "./resource-policy.js";
import type { CatalogConfigInput, CompileCatalogOptions, CompileCatalogResult } from "./types.js";
import {
  staleReviewDiagnostic,
  unknownDependencyDiagnostics,
  validateParsedManifest
} from "./validator.js";

const DEFAULT_TOOL_VERSION = "0.5.16";
const DEFAULT_PARSE_CONCURRENCY = 16;

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
    maxManifests: options.maxManifests ?? config.limits.maxManifests,
    followSymlinks: options.followSymlinks ?? false
  });
  const diagnostics: Diagnostic[] = [...discovery.diagnostics];
  const validatedManifests = [];
  const parseConcurrency = normalizeConcurrency(
    options.parseConcurrency ?? DEFAULT_PARSE_CONCURRENCY
  );

  const totalManifestBytes = discovery.manifests.reduce(
    (total, manifest) => total + manifest.sizeBytes,
    0
  );
  const inputBudgetExceeded = totalManifestBytes > config.limits.maxTotalManifestBytes;
  if (inputBudgetExceeded) {
    diagnostics.push(
      resourceLimitDiagnostic(
        "Total manifest bytes exceed the configured aggregate limit.",
        "Reduce scan scope or raise limits.maxTotalManifestBytes."
      )
    );
  }

  const parsedManifests = inputBudgetExceeded
    ? []
    : await mapWithConcurrency(discovery.manifests, parseConcurrency, async (discoveredManifest) =>
        parseManifestFile(discoveredManifest, {
          maxManifestBytes: options.maxManifestBytes ?? config.limits.maxManifestBytes,
          maxObjectDepth: config.limits.maxObjectDepth
        })
      );

  const totalCollectionEntries = parsedManifests.reduce(
    (total, parsed) => total + (parsed.ok ? parsed.metrics.collectionEntries : 0),
    0
  );
  const collectionBudgetExceeded = totalCollectionEntries > config.limits.maxCollectionEntries;
  if (collectionBudgetExceeded) {
    diagnostics.push(
      resourceLimitDiagnostic(
        "Manifest collection entries exceed the configured aggregate limit.",
        "Reduce manifest collections or raise limits.maxCollectionEntries."
      )
    );
  }

  for (const parsed of parsedManifests) {
    if (collectionBudgetExceeded) {
      break;
    }
    const validated = validateParsedManifest(parsed, options.inputSchema ?? "scg-v1");
    if (validated.ok) {
      validatedManifests.push(validated);
    } else {
      diagnostics.push(...validated.diagnostics);
    }
  }

  const totalExtensionBytes = validatedManifests.reduce(
    (total, validated) =>
      total +
      (validated.manifest.extensions ? serializedByteLength(validated.manifest.extensions) : 0),
    0
  );
  if (totalExtensionBytes > config.limits.maxExtensionBytes) {
    validatedManifests.length = 0;
    diagnostics.push(
      resourceLimitDiagnostic(
        "Manifest extensions exceed the configured aggregate byte limit.",
        "Reduce extension payloads or raise limits.maxExtensionBytes."
      )
    );
  }

  const normalizedServices = sortServiceRecords(
    validatedManifests.map((validated) =>
      normalizeServiceRecord(validated.manifest, validated.file.relativePath, config)
    )
  );
  const duplicateResult = isolateDuplicateServiceIds(normalizedServices);
  const services = duplicateResult.services;
  diagnostics.push(...duplicateResult.diagnostics);
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

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

function normalizeConcurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PARSE_CONCURRENCY;
  }

  return Math.max(1, Math.min(64, Math.trunc(value)));
}

function isolateDuplicateServiceIds(services: CompileCatalogResult["services"]): {
  services: CompileCatalogResult["services"];
  diagnostics: Diagnostic[];
} {
  const sourcePathsById = new Map<string, string[]>();

  for (const service of services) {
    sourcePathsById.set(service.id, [
      ...(sourcePathsById.get(service.id) ?? []),
      service.source.path
    ]);
  }

  const duplicateIds = new Set(
    [...sourcePathsById.entries()]
      .filter(([, sourcePaths]) => sourcePaths.length > 1)
      .map(([serviceId]) => serviceId)
  );
  const diagnostics = [...sourcePathsById.entries()]
    .filter(([, sourcePaths]) => sourcePaths.length > 1)
    .flatMap(([serviceId, sourcePaths]) =>
      sourcePaths.map((sourcePath) =>
        createDuplicateServiceIdDiagnostic(serviceId, sourcePath, sourcePaths)
      )
    );

  return {
    services: services.filter((service) => !duplicateIds.has(service.id)),
    diagnostics
  };
}

function createDuplicateServiceIdDiagnostic(
  serviceId: string,
  sourcePath: string,
  sourcePaths: string[]
): Diagnostic {
  return {
    severity: "error",
    code: "manifest.duplicate_id",
    file: sourcePath,
    field: "id",
    message: `Service id ${serviceId} is declared by multiple manifests.`,
    hint: duplicateSourceHint(sourcePaths)
  };
}

function duplicateSourceHint(sourcePaths: string[]): string {
  const displayed = sourcePaths.slice(0, 5);
  const remaining = sourcePaths.length - displayed.length;
  const suffix = remaining > 0 ? `, and ${remaining} more` : "";
  return `Use a unique service id. ${sourcePaths.length} duplicate sources: ${displayed.join(", ")}${suffix}.`.slice(
    0,
    500
  );
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
    limits: {
      ...defaults.limits,
      ...input.limits
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

function resourceLimitDiagnostic(message: string, hint: string): Diagnostic {
  return {
    severity: "error",
    code: "resource.limit_exceeded",
    message,
    hint
  };
}
