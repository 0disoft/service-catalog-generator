import type { CatalogConfig, ServiceManifest, ServiceRecord } from "@scg/schema";
import { redactOwnerRef } from "./redaction.js";

export function normalizeServiceRecord(
  manifest: ServiceManifest,
  sourcePath: string,
  config: CatalogConfig
): ServiceRecord {
  return {
    id: manifest.id,
    name: manifest.name,
    lifecycle: manifest.lifecycle,
    owner: {
      type: manifest.owner.type,
      ref: config.privacy.redactOwnerEmails
        ? redactOwnerRef(manifest.owner.ref)
        : manifest.owner.ref
    },
    repository: manifest.repository,
    runtime: manifest.runtime,
    deploy: manifest.deploy,
    data: manifest.data,
    dependencies: manifest.dependencies,
    ...(manifest.cost ? { cost: manifest.cost } : {}),
    ...(manifest.retirement ? { retirement: manifest.retirement } : {}),
    metadata: manifest.metadata,
    source: {
      path: sourcePath
    }
  };
}

export function sortServiceRecords(services: ServiceRecord[]): ServiceRecord[] {
  return [...services].sort((left, right) => left.id.localeCompare(right.id));
}
