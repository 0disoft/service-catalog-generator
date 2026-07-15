import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogConfig, Diagnostic } from "@scg/schema";
import { isPathInside, normalizeAbsolutePath, toPosixPath } from "./path-policy.js";
import type { InputSchema } from "./types.js";

export type ResolvedDiscoverySource = {
  root: string;
  rootRealPath?: string;
  manifestNames: string[];
  inputSchema: InputSchema;
};

export class SourceConfigError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(message: string, hint: string, field?: string) {
    super(message);
    this.name = "SourceConfigError";
    this.diagnostic = {
      severity: "error",
      code: "config.invalid",
      ...(field ? { field } : {}),
      message,
      hint
    };
  }
}

export async function resolveDiscoverySources(
  cwd: string,
  config: CatalogConfig,
  legacyInputSchema: InputSchema = "scg-v1"
): Promise<ResolvedDiscoverySource[]> {
  if (!config.sources) {
    return config.scan.roots.map((root) => ({
      root,
      manifestNames: config.scan.manifestNames,
      inputSchema: legacyInputSchema
    }));
  }

  const workspacePath = normalizeAbsolutePath(cwd);
  const workspaceRealPath = await realpath(workspacePath);
  const resolvedSources: ResolvedDiscoverySource[] = [];

  for (const [index, source] of config.sources.entries()) {
    const sourcePath = resolve(workspacePath, source.root);
    if (!isPathInside(workspacePath, sourcePath)) {
      throw invalidSourceRoot(index, source.root);
    }

    let sourceRealPath: string;
    try {
      sourceRealPath = await realpath(sourcePath);
    } catch {
      throw new SourceConfigError(
        `Source root does not exist or cannot be resolved: ${toPosixPath(source.root)}`,
        "Create the source directory or update sources[].root.",
        `sources.${index}.root`
      );
    }

    if (!isPathInside(workspaceRealPath, sourceRealPath)) {
      throw invalidSourceRoot(index, source.root);
    }

    resolvedSources.push({
      root: source.root,
      rootRealPath: sourceRealPath,
      manifestNames: source.manifestNames,
      inputSchema: source.inputSchema
    });
  }

  const sortedSources = resolvedSources.sort((left, right) =>
    (left.rootRealPath ?? left.root).localeCompare(right.rootRealPath ?? right.root)
  );
  for (let leftIndex = 0; leftIndex < sortedSources.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sortedSources.length; rightIndex += 1) {
      const left = sortedSources[leftIndex];
      const right = sortedSources[rightIndex];
      const leftRealPath = left.rootRealPath as string;
      const rightRealPath = right.rootRealPath as string;
      if (
        !isPathInside(leftRealPath, rightRealPath) &&
        !isPathInside(rightRealPath, leftRealPath)
      ) {
        continue;
      }

      throw new SourceConfigError(
        `Source roots overlap after realpath resolution: ${toPosixPath(left.root)} and ${toPosixPath(right.root)}`,
        "Use disjoint source roots so every manifest has exactly one input schema owner.",
        "sources"
      );
    }
  }

  return sortedSources;
}

function invalidSourceRoot(index: number, root: string): SourceConfigError {
  return new SourceConfigError(
    `Source root resolves outside the workspace: ${toPosixPath(root)}`,
    "Use a workspace-relative source root that does not traverse through an external symlink.",
    `sources.${index}.root`
  );
}
