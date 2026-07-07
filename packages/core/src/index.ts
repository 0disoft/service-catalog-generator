export { compileCatalog, resolveCatalogConfig } from "./scan.js";
export { adaptParsedManifest } from "./adapters.js";
export { discoverManifestFiles } from "./discovery.js";
export { parseManifestFile } from "./parser.js";
export { normalizeServiceRecord, sortServiceRecords } from "./normalizer.js";
export { buildGraphEdges, sortGraphEdges } from "./graph.js";
export { createDiagnostic, sortDiagnostics, summarizeDiagnostics } from "./diagnostics.js";
export { redactOwnerRef, redactSecretLikeValue, stripAnsiAndControl } from "./redaction.js";
export type {
  CatalogConfigInput,
  CompileCatalogOptions,
  CompileCatalogResult,
  CorePackageBoundary,
  CoreSchemaDependency,
  DiscoveredManifest,
  InputSchema,
  ParsedManifest,
  ValidatedManifest
} from "./types.js";

export const packageName = "@scg/core";
