import { SERVICE_MANIFEST_SCHEMA_VERSION, type Diagnostic } from "@scg/schema";
import { createDiagnostic } from "./diagnostics.js";
import type { InputSchema, ParsedManifest } from "./types.js";

export type AdaptedManifest =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      diagnostics: Diagnostic[];
    };

export function adaptParsedManifest(
  parsed: Extract<ParsedManifest, { ok: true }>,
  inputSchema: InputSchema
): AdaptedManifest {
  switch (inputSchema) {
    case "scg-v1":
      return {
        ok: true,
        value: parsed.value
      };
    case "zdp-v2":
      return adaptZdpV2Manifest(parsed.value, parsed.file.relativePath);
  }
}

function adaptZdpV2Manifest(value: unknown, file: string): AdaptedManifest {
  const root = asRecord(value);
  const contract = asRecord(root?.contract);
  const service = asRecord(root?.service);

  if (!root || !contract || !service) {
    return invalidAdapterInput(file, "ZDP v2 input requires contract and service mappings.");
  }

  if (contract.schema_version !== 2) {
    return invalidAdapterInput(file, "ZDP v2 input requires contract.schema_version: 2.");
  }

  const id = readString(service.id);
  const repo = readString(service.repo) ?? id;
  const owner = readString(service.owner) ?? "unknown";
  const lastReviewedAt = readDate(contract.last_reviewed_at);
  if (!id) {
    return invalidAdapterInput(file, "ZDP v2 input requires service.id.");
  }
  if (!lastReviewedAt) {
    return invalidAdapterInput(
      file,
      "ZDP v2 input requires contract.last_reviewed_at in YYYY-MM-DD format.",
      "contract.last_reviewed_at"
    );
  }

  const runtime = asRecord(root.runtime);
  const domain = asRecord(root.domain);
  const lifecycle = asRecord(root.lifecycle);
  const data = asRecord(root.data);
  const cost = asRecord(root.cost);
  const dependencies = asRecord(root.dependencies);

  return {
    ok: true,
    value: {
      schemaVersion: SERVICE_MANIFEST_SCHEMA_VERSION,
      id,
      name: readString(service.display_name) ?? id,
      lifecycle: mapLifecycle(readString(service.status)),
      owner: {
        type: "system",
        ref: toOwnerRef(owner)
      },
      repository: {
        provider: "local",
        slug: repo
      },
      runtime: {
        language: "unknown",
        platform: firstString(runtime?.core, runtime?.framework, runtime?.edge) ?? "unknown",
        ...(firstString(runtime?.framework, runtime?.core, runtime?.edge)
          ? { framework: firstString(runtime?.framework, runtime?.core, runtime?.edge) }
          : {})
      },
      deploy: {
        type: "unknown",
        targets: [
          {
            environment: "contract",
            provider: "zdp",
            ref: `${id}-contract`
          }
        ]
      },
      data: {
        storesPersonalData: hasPersonalData(data),
        classification: mapDataClassification(readString(data?.pii_level))
      },
      dependencies: mapDependencies(dependencies),
      ...(readString(cost?.owner) ? { cost: { owner: toOwnerRef(readString(cost?.owner)) } } : {}),
      metadata: {
        lastReviewedAt
      },
      extensions: {
        zdp: compactRecord({
          contractVersion: readNumber(contract.contract_version),
          schemaVersion: contract.schema_version,
          tier: readString(service.tier),
          riskLevel: readString(service.risk_level),
          domainType: readString(domain?.type),
          stage: readString(lifecycle?.stage),
          costCenter: readString(cost?.cost_center),
          moneyMovement: readBoolean(domain?.money_movement) ?? readBoolean(data?.money_movement),
          userFacing: readBoolean(domain?.user_facing),
          publicApi: readBoolean(domain?.public_api)
        })
      }
    }
  };
}

function mapLifecycle(status: string | undefined): string {
  switch (status) {
    case "active":
    case "scaling":
      return "production";
    case "maintenance":
      return "deprecated";
    case "sunset":
      return "retired";
    case "experiment":
    default:
      return "experimental";
  }
}

function mapDataClassification(piiLevel: string | undefined): string {
  switch (piiLevel) {
    case "regulated":
    case "high":
      return "confidential";
    case "medium":
      return "restricted";
    case "low":
    case "none":
    default:
      return "internal";
  }
}

function mapDependencies(dependencies: Record<string, unknown> | undefined): unknown[] {
  if (!dependencies) {
    return [];
  }

  return [
    ...dependencyList(dependencies.services, "service"),
    ...dependencyList(dependencies.datastores, "database"),
    ...dependencyList(dependencies.queues, "queue"),
    ...dependencyList(dependencies.internal_apis, "api"),
    ...dependencyList(dependencies.workers, "external")
  ];
}

function dependencyList(value: unknown, type: string): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readString(item))
    .filter((item): item is string => Boolean(item))
    .map((target) => ({
      type,
      target: toStableId(target),
      direction: "outbound",
      criticality: "required"
    }));
}

function hasPersonalData(data: Record<string, unknown> | undefined): boolean {
  return (
    readString(data?.pii_level) !== "none" ||
    readBoolean(data?.payment_data) === true ||
    readBoolean(data?.message_content) === true ||
    readBoolean(data?.ai_user_data) === true
  );
}

function invalidAdapterInput(file: string, message: string, field?: string): AdaptedManifest {
  return {
    ok: false,
    diagnostics: [
      createDiagnostic({
        severity: "error",
        code: "adapter.invalid_input",
        file,
        ...(field ? { field } : {}),
        message,
        hint: "Use --input-schema scg-v1 for SCG manifests or provide a ZDP v2 service.yaml."
      })
    ]
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readDate(value: unknown): string | undefined {
  const text = readString(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = readString(value);
    if (text) {
      return text;
    }
  }

  return undefined;
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function toOwnerRef(value: string | undefined): string {
  return `system:${toStableId(value ?? "unknown")}`;
}

function toStableId(value: string): string {
  let normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  if (normalized.startsWith("-")) {
    normalized = normalized.slice(1);
  }
  if (normalized.endsWith("-")) {
    normalized = normalized.slice(0, -1);
  }

  if (!normalized) {
    return "unknown";
  }

  return /^[a-z]/.test(normalized) ? normalized : `id-${normalized}`;
}
