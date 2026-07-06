import type { GraphEdge, ServiceRecord } from "@scg/schema";

export function buildGraphEdges(services: ServiceRecord[]): GraphEdge[] {
  const edges = services.flatMap((service) =>
    service.dependencies.map((dependency) => ({
      source: service.id,
      target: dependency.target,
      type: dependency.type,
      criticality: dependency.criticality
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
      right.criticality
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
