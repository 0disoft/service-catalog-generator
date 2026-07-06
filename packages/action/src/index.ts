import type { CliPackageBoundary } from "@scg/cli";

export const packageName = "@scg/action";

export type ActionPackageBoundary = "input-mapping" | "output-mapping" | "cli-exit-propagation";

export type ActionCliDependency = CliPackageBoundary;
