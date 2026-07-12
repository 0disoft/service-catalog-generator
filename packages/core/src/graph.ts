import type { GraphEdge, ServiceRecord } from "@scg/schema";

export function buildGraphEdges(services: ServiceRecord[]): GraphEdge[] {
  const knownServiceIds = new Set(services.map((service) => service.id));
  const edges = services.flatMap((service) =>
    service.dependencies.map((dependency) => ({
      source: service.id,
      target: dependency.target,
      type: dependency.type,
      criticality: dependency.criticality,
      direction: dependency.direction,
      resolution:
        dependency.type === "service"
          ? knownServiceIds.has(dependency.target)
            ? ("catalog" as const)
            : ("unresolved" as const)
          : ("external" as const)
    }))
  );

  return sortGraphEdges(edges);
}

export function sortGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((left, right) =>
    compareStrings(
      left.source,
      right.source,
      left.target,
      right.target,
      left.type,
      right.type,
      left.criticality,
      right.criticality,
      left.direction,
      right.direction,
      left.resolution,
      right.resolution
    )
  );
}

function compareStrings(...values: string[]): number {
  for (let index = 0; index < values.length; index += 2) {
    const comparison = values[index].localeCompare(values[index + 1] ?? "");
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}
