import type { CorePackageBoundary } from "@scg/core";

export const packageName = "@scg/report";

export type ReportPackageBoundary = "catalog-json" | "graph-dot" | "static-html";

export type ReportCoreDependency = CorePackageBoundary;
