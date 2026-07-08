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
  .strict()
  .superRefine((snapshot, ctx) => {
    if (snapshot.summary.serviceCount !== snapshot.services.length) {
      ctx.addIssue({
        code: "custom",
        path: ["summary", "serviceCount"],
        message: "summary.serviceCount must match services.length."
      });
    }

    if (snapshot.summary.edgeCount !== snapshot.graph.edges.length) {
      ctx.addIssue({
        code: "custom",
        path: ["summary", "edgeCount"],
        message: "summary.edgeCount must match graph.edges.length."
      });
    }

    const errorCount = snapshot.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error"
    ).length;
    if (snapshot.summary.errorCount !== errorCount) {
      ctx.addIssue({
        code: "custom",
        path: ["summary", "errorCount"],
        message: "summary.errorCount must match error diagnostics."
      });
    }

    const warningCount = snapshot.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning"
    ).length;
    if (snapshot.summary.warningCount !== warningCount) {
      ctx.addIssue({
        code: "custom",
        path: ["summary", "warningCount"],
        message: "summary.warningCount must match warning diagnostics."
      });
    }
  });

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;
