import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { Diagnostic } from "@scg/schema";
import { createDiagnostic } from "./diagnostics.js";
import {
  isPathInside,
  normalizeAbsolutePath,
  relativePathFrom,
  toPosixPath
} from "./path-policy.js";
import type { DiscoveredManifest } from "./types.js";

const DEFAULT_EXCLUDED_SEGMENTS = new Set([".git", "node_modules", "dist", "coverage", ".catalog"]);

export type DiscoverManifestOptions = {
  cwd: string;
  roots: string[];
  manifestNames: string[];
  exclude: string[];
  outputDirectory: string;
  maxManifests: number;
  followSymlinks: boolean;
};

export type DiscoverManifestResult = {
  manifests: DiscoveredManifest[];
  diagnostics: Diagnostic[];
};

export async function discoverManifestFiles(
  options: DiscoverManifestOptions
): Promise<DiscoverManifestResult> {
  const cwd = normalizeAbsolutePath(options.cwd);
  const cwdRealPath = await realpath(cwd);
  const diagnostics: Diagnostic[] = [];
  const manifests: DiscoveredManifest[] = [];
  const visitedDirectories = new Set<string>();
  const excludedSegments = excludedPathSegments(options.exclude, options.outputDirectory);

  for (const root of options.roots) {
    const rootPath = resolve(cwd, root);
    if (!isPathInside(cwd, rootPath)) {
      diagnostics.push(outsideScanRootDiagnostic(toPosixPath(root)));
      continue;
    }

    const rootRealPath = await safeRealpath(rootPath);
    if (!rootRealPath || !isPathInside(cwdRealPath, rootRealPath)) {
      diagnostics.push(outsideScanRootDiagnostic(toPosixPath(root)));
      continue;
    }

    await walkDirectory({
      directory: rootRealPath,
      rootRealPath,
      cwdRealPath,
      manifestNames: new Set(options.manifestNames),
      excludedSegments,
      followSymlinks: options.followSymlinks,
      maxManifests: options.maxManifests,
      visitedDirectories,
      manifests,
      diagnostics
    });
  }

  return {
    manifests: manifests.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    diagnostics
  };
}

type WalkState = {
  directory: string;
  rootRealPath: string;
  cwdRealPath: string;
  manifestNames: Set<string>;
  excludedSegments: Set<string>;
  followSymlinks: boolean;
  maxManifests: number;
  visitedDirectories: Set<string>;
  manifests: DiscoveredManifest[];
  diagnostics: Diagnostic[];
};

async function walkDirectory(state: WalkState): Promise<void> {
  const directoryRealPath = await safeRealpath(state.directory);
  if (!directoryRealPath || state.visitedDirectories.has(directoryRealPath)) {
    return;
  }

  if (!isPathInside(state.rootRealPath, directoryRealPath)) {
    state.diagnostics.push(outsideScanRootDiagnostic(toPosixPath(state.directory)));
    return;
  }

  state.visitedDirectories.add(directoryRealPath);

  const entries = await readdir(directoryRealPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = resolve(directoryRealPath, entry.name);
    const relativeToRoot = relativePathFrom(state.rootRealPath, absolutePath);
    if (!relativeToRoot || shouldExclude(relativeToRoot, state.excludedSegments)) {
      continue;
    }

    const linkStats = await lstat(absolutePath);
    if (linkStats.isSymbolicLink() && !state.followSymlinks) {
      continue;
    }

    const entryStats = linkStats.isSymbolicLink() ? await stat(absolutePath) : linkStats;

    if (entryStats.isDirectory()) {
      await walkDirectory({
        ...state,
        directory: absolutePath
      });
      continue;
    }

    if (!entryStats.isFile() || !state.manifestNames.has(basename(entry.name))) {
      continue;
    }

    const fileRealPath = await safeRealpath(absolutePath);
    if (!fileRealPath || !isPathInside(state.rootRealPath, fileRealPath)) {
      state.diagnostics.push(outsideScanRootDiagnostic(relativeToRoot));
      continue;
    }

    if (state.manifests.length >= state.maxManifests) {
      state.diagnostics.push(
        createDiagnostic({
          severity: "error",
          code: "config.invalid",
          message: "Manifest count exceeds the configured scan limit.",
          hint: "Narrow scan.roots or raise the manifest count limit."
        })
      );
      return;
    }

    const relativeToCwd = relativePathFrom(state.cwdRealPath, fileRealPath);
    if (!relativeToCwd) {
      state.diagnostics.push(outsideScanRootDiagnostic(relativeToRoot));
      continue;
    }

    state.manifests.push({
      absolutePath,
      realPath: fileRealPath,
      relativePath: relativeToCwd,
      rootRealPath: state.rootRealPath
    });
  }
}

function excludedPathSegments(exclude: string[], outputDirectory: string): Set<string> {
  const segments = new Set(DEFAULT_EXCLUDED_SEGMENTS);

  for (const pattern of [...exclude, `${outputDirectory}/**`]) {
    const normalized = pattern.replaceAll("\\", "/").replace(/\/\*\*$/, "");
    for (const segment of normalized.split("/")) {
      if (segment && segment !== "**" && !segment.includes("*")) {
        segments.add(segment);
      }
    }
  }

  return segments;
}

function shouldExclude(relativePath: string, excludedSegments: Set<string>): boolean {
  return relativePath.split("/").some((segment) => excludedSegments.has(segment));
}

async function safeRealpath(path: string): Promise<string | undefined> {
  try {
    return await realpath(path);
  } catch {
    return undefined;
  }
}

function outsideScanRootDiagnostic(path: string): Diagnostic {
  return createDiagnostic({
    severity: "error",
    code: "path.outside_scan_root",
    file: path,
    message: "Scan path resolves outside the allowed scan root.",
    hint: "Use a scan root inside the current workspace and avoid traversal through symlinks."
  });
}
