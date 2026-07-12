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

const DEFAULT_EXCLUDE_PATTERNS = [
  ".git/**",
  "node_modules/**",
  "dist/**",
  "coverage/**",
  ".catalog/**"
];

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
    const excludeRules = createExcludeRules(
      options.exclude,
      options.outputDirectory,
      cwdRealPath,
      rootRealPath
    );

    await walkDirectory({
      directory: rootRealPath,
      rootRealPath,
      cwdRealPath,
      manifestNames: new Set(options.manifestNames),
      excludeRules,
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
  excludeRules: ExcludeRule[];
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
    if (!relativeToRoot || shouldExclude(relativeToRoot, state.excludeRules)) {
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

type ExcludeRule = {
  segments: string[];
};

function createExcludeRules(
  exclude: string[],
  outputDirectory: string,
  cwdRealPath: string,
  rootRealPath: string
): ExcludeRule[] {
  const patterns = [...DEFAULT_EXCLUDE_PATTERNS, ...exclude];
  const outputDirectoryPath = resolve(cwdRealPath, outputDirectory);
  const outputDirectoryRelativeToRoot = relativePathFrom(rootRealPath, outputDirectoryPath);
  if (outputDirectoryRelativeToRoot) {
    patterns.push(`${outputDirectoryRelativeToRoot}/**`);
  }

  return [...new Set(patterns)]
    .map(normalizeExcludePattern)
    .filter((pattern) => pattern.length > 0)
    .map((pattern) => ({
      segments: pattern.split("/")
    }));
}

function normalizeExcludePattern(pattern: string): string {
  return pattern
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function shouldExclude(relativePath: string, excludeRules: ExcludeRule[]): boolean {
  const normalized = normalizeExcludePattern(relativePath);
  const pathSegments = normalized.split("/");
  return excludeRules.some((rule) => matchGlobSegments(rule.segments, pathSegments));
}

function matchGlobSegments(patternSegments: string[], pathSegments: string[]): boolean {
  return matchGlobSegmentAt(patternSegments, pathSegments, 0, 0, new Map());
}

function matchGlobSegmentAt(
  patternSegments: string[],
  pathSegments: string[],
  patternIndex: number,
  pathIndex: number,
  memo: Map<string, boolean>
): boolean {
  const state = `${patternIndex}:${pathIndex}`;
  const cached = memo.get(state);
  if (cached !== undefined) {
    return cached;
  }

  let matched: boolean;
  if (patternIndex === patternSegments.length) {
    matched = pathIndex === pathSegments.length;
  } else if (patternSegments[patternIndex] === "**") {
    if (patternIndex === patternSegments.length - 1) {
      matched = true;
    } else {
      matched = false;
      for (
        let nextPathIndex = pathIndex;
        nextPathIndex <= pathSegments.length;
        nextPathIndex += 1
      ) {
        if (
          matchGlobSegmentAt(patternSegments, pathSegments, patternIndex + 1, nextPathIndex, memo)
        ) {
          matched = true;
          break;
        }
      }
    }
  } else if (pathIndex >= pathSegments.length) {
    matched = false;
  } else {
    matched =
      matchGlobSegment(patternSegments[patternIndex], pathSegments[pathIndex]) &&
      matchGlobSegmentAt(patternSegments, pathSegments, patternIndex + 1, pathIndex + 1, memo);
  }

  memo.set(state, matched);
  return matched;
}

function matchGlobSegment(patternSegment: string, pathSegment: string): boolean {
  const source = [...patternSegment]
    .map((character) =>
      character === "*" ? "[^/]*" : character === "?" ? "[^/]" : escapeRegExp(character)
    )
    .join("");
  return new RegExp(`^${source}$`).test(pathSegment);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
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
