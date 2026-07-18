export {
  CATALOG_CONFIG_SCHEMA_VERSION,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  LEGACY_CATALOG_CONFIG_SCHEMA_VERSION,
  LEGACY_SERVICE_MANIFEST_SCHEMA_VERSION,
  SERVICE_MANIFEST_SCHEMA_VERSION
} from "./versions.js";
export {
  CatalogSnapshotSchema,
  CatalogSummarySchema,
  CatalogToolSchema,
  GraphEdgeSchema,
  type CatalogSnapshot,
  type GraphEdge
} from "./catalog.js";
export {
  CATALOG_RESOURCE_LIMIT_DEFAULTS,
  CatalogConfigSchema,
  CatalogInputSchemaSchema,
  type CatalogConfig,
  type CatalogConfigInput,
  type CatalogInputSchema
} from "./config.js";
export { DiagnosticSchema, type Diagnostic } from "./diagnostic.js";
export {
  CostRefSchema,
  DataProfileSchema,
  DependencyRefSchema,
  DeployTargetSchema,
  DeploymentProfileSchema,
  ManifestMetadataSchema,
  OwnerRefSchema,
  RepositoryRefSchema,
  RetirementSchema,
  RuntimeProfileSchema,
  ServiceExtensionsSchema,
  ServiceManifestSchema,
  ServiceRecordSchema,
  ServiceSourceSchema,
  type DataProfile,
  type DependencyRef,
  type DeployTarget,
  type DeploymentProfile,
  type OwnerRef,
  type RepositoryRef,
  type RuntimeProfile,
  type ServiceExtensions,
  type ServiceManifest,
  type ServiceRecord
} from "./service-manifest.js";

export const packageName = "@scg/schema";

export type SchemaPackageBoundary =
  | "service-manifest-schema"
  | "catalog-snapshot-schema"
  | "diagnostic-schema"
  | "config-schema";
