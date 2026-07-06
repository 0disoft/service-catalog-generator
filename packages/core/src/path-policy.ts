import { relative, resolve, sep } from "node:path";

export function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

export function normalizeAbsolutePath(path: string): string {
  return resolve(path);
}

export function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = normalizeForComparison(parent);
  const normalizedChild = normalizeForComparison(child);

  return (
    normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${sep}`)
  );
}

export function relativePathFrom(parent: string, child: string): string | undefined {
  if (!isPathInside(parent, child)) {
    return undefined;
  }

  const relativePath = relative(parent, child);
  if (!relativePath || relativePath.startsWith("..")) {
    return undefined;
  }

  return toPosixPath(relativePath);
}

function normalizeForComparison(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
