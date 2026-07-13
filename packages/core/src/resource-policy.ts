export type ValueStructureMetrics = {
  collectionEntries: number;
  maxDepth: number;
};

export function measureValueStructure(value: unknown): ValueStructureMetrics {
  const visited = new WeakSet<object>();
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let collectionEntries = 0;
  let maxDepth = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current.value !== "object" || current.value === null) {
      continue;
    }
    if (visited.has(current.value)) {
      continue;
    }
    visited.add(current.value);
    maxDepth = Math.max(maxDepth, current.depth);

    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);
    collectionEntries += children.length;
    for (const child of children) {
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }

  return { collectionEntries, maxDepth };
}

export function serializedByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
