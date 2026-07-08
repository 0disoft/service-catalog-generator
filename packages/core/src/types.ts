import type {
  CatalogConfig,
  CatalogSnapshot,
  DependencyRef,
  Diagnostic,
  GraphEdge,
  ServiceManifest,
  ServiceRecord
} from "@scg/schema";

export type InputSchema = "scg-v1" | "zdp-v2";

export type CatalogConfigInput = {
  schemaVersion?: CatalogConfig["schemaVersion"];
  scan?: Partial<CatalogConfig["scan"]>;
  validation?: Partial<CatalogConfig["validation"]>;
  output?: Partial<CatalogConfig["output"]>;
  privacy?: Partial<CatalogConfig["privacy"]>;
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
};

export type ParsedManifest =
  | {
      ok: true;
      file: DiscoveredManifest;
      value: unknown;
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
  "adapter" | "discovery" | "parser" | "normalizer" | "validator" | "graph";

export type CoreSchemaDependency = import("@scg/schema").SchemaPackageBoundary;

export type CompileCatalogResult = {
  config: CatalogConfig;
  snapshot: CatalogSnapshot;
  diagnostics: Diagnostic[];
  services: ServiceRecord[];
  graphEdges: GraphEdge[];
  discoveredManifests: DiscoveredManifest[];
};
