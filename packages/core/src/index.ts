import type { SchemaPackageBoundary } from "@scg/schema";

export const packageName = "@scg/core";

export type CorePackageBoundary = "discovery" | "parser" | "normalizer" | "validator" | "graph";

export type CoreSchemaDependency = SchemaPackageBoundary;
