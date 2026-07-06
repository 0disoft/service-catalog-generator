import type { CorePackageBoundary } from "@scg/core";

export const packageName = "@scg/cli";

export type CliPackageBoundary =
  "commands" | "flags" | "config-precedence" | "human-output" | "json-output" | "exit-codes";

export type CliCoreDependency = CorePackageBoundary;
