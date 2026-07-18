import type {
  CatalogConfig,
  CatalogConfigInput as SchemaCatalogConfigInput,
  CatalogSnapshot,
  DependencyRef,
  Diagnostic,
  GraphEdge,
  ServiceManifest,
  ServiceRecord
} from "@scg/schema";

export type InputSchema = import("@scg/schema").CatalogInputSchema;
export type CatalogConfigInput = Omit<SchemaCatalogConfigInput, "schemaVersion"> & {
  schemaVersion?: SchemaCatalogConfigInput["schemaVersion"];
};

export type CompileCatalogOptions = {
  cwd?: string;
  config?: CatalogConfigInput;
  toolVersion?: string;
  now?: Date;
  maxManifestBytes?: number;
  maxManifests?: number;
  parseConcurrency?: number;
  followSymlinks?: boolean;
  inputSchema?: InputSchema;
};

export type DiscoveredManifest = {
  absolutePath: string;
  realPath: string;
  relativePath: string;
  rootRealPath: string;
  sizeBytes: number;
  inputSchema: InputSchema;
};

export type ParsedManifest =
  | {
      ok: true;
      file: DiscoveredManifest;
      value: unknown;
      metrics: {
        collectionEntries: number;
        maxDepth: number;
      };
    }
  | {
      ok: false;
      file: DiscoveredManifest;
      diagnostics: Diagnostic[];
    };

export type ValidatedManifest =
  | {
      ok: true;
      file: DiscoveredManifest;
      manifest: ServiceManifest;
    }
  | {
      ok: false;
      file: DiscoveredManifest;
      diagnostics: Diagnostic[];
    };

export type ServiceDependency = DependencyRef;

export type CorePackageBoundary =
  | "adapter"
  | "discovery"
  | "parser"
  | "normalizer"
  | "validator"
  | "graph";

export type CoreSchemaDependency = import("@scg/schema").SchemaPackageBoundary;

export type CompileCatalogResult = {
  config: CatalogConfig;
  snapshot: CatalogSnapshot;
  diagnostics: Diagnostic[];
  services: ServiceRecord[];
  graphEdges: GraphEdge[];
  discoveredManifests: DiscoveredManifest[];
};
