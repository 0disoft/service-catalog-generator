import { z } from "zod";
import { DiagnosticSchema } from "./diagnostic.js";
import { DependencyCriticalitySchema, DependencyTypeSchema, StableIdSchema } from "./shared.js";
import { ServiceRecordSchema } from "./service-manifest.js";
import { CATALOG_SNAPSHOT_SCHEMA_VERSION } from "./versions.js";

export const GraphEdgeSchema = z
  .object({
    source: StableIdSchema,
    target: StableIdSchema,
    type: DependencyTypeSchema,
    criticality: DependencyCriticalitySchema
  })
  .strict();

export const CatalogSummarySchema = z
  .object({
    serviceCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative()
  })
  .strict();

export const CatalogToolSchema = z
  .object({
    name: z.literal("service-catalog-generator"),
    version: z.string().min(1)
  })
  .strict();

export const CatalogSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CATALOG_SNAPSHOT_SCHEMA_VERSION),
    tool: CatalogToolSchema,
    summary: CatalogSummarySchema,
    services: z.array(ServiceRecordSchema),
    diagnostics: z.array(DiagnosticSchema),
    graph: z
      .object({
        edges: z.array(GraphEdgeSchema)
      })
      .strict()
  })
  .strict();

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;
