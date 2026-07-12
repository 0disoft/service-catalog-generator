import { z } from "zod";
import { addSecretLikeIssues } from "./secret-scan.js";
import {
  DataClassificationSchema,
  DateOnlySchema,
  DependencyCriticalitySchema,
  DependencyDirectionSchema,
  DependencyTypeSchema,
  DisplayNameSchema,
  LifecycleSchema,
  ReferenceValueSchema,
  RelativePathSchema,
  StableIdSchema
} from "./shared.js";
import { SERVICE_MANIFEST_SCHEMA_VERSION } from "./versions.js";

export const OwnerRefSchema = z
  .object({
    type: z.enum(["team", "group", "user", "system"]),
    ref: ReferenceValueSchema
  })
  .strict();

export const RepositoryRefSchema = z
  .object({
    provider: z.enum(["github", "gitlab", "bitbucket", "local", "url", "unknown"]),
    slug: z.string().min(1).max(200).optional(),
    url: z.string().url().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.slug && !value.url) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "repository.slug or repository.url is required."
      });
    }

    if (value.url && hasUrlUserInfo(value.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "repository.url must not contain embedded credentials."
      });
    }
  });

function hasUrlUserInfo(value: string): boolean {
  const authorityStart = value.indexOf("://") + 3;
  if (authorityStart < 3) {
    return false;
  }

  const authorityEndCandidates = ["/", "?", "#"]
    .map((separator) => value.indexOf(separator, authorityStart))
    .filter((index) => index >= 0);
  const authorityEnd =
    authorityEndCandidates.length > 0 ? Math.min(...authorityEndCandidates) : value.length;
  return value.slice(authorityStart, authorityEnd).includes("@");
}

export const RuntimeProfileSchema = z
  .object({
    language: z.string().min(1).max(80),
    platform: z.string().min(1).max(80),
    framework: z.string().min(1).max(80).optional()
  })
  .strict();

export const DeployTargetSchema = z
  .object({
    environment: z.string().min(1).max(80),
    provider: z.string().min(1).max(80),
    ref: ReferenceValueSchema
  })
  .strict();

export const DeploymentProfileSchema = z
  .object({
    type: z.enum(["container", "serverless", "static", "library", "job", "unknown"]),
    targets: z.array(DeployTargetSchema).min(1)
  })
  .strict();

export const DataProfileSchema = z
  .object({
    storesPersonalData: z.boolean().optional(),
    classification: DataClassificationSchema
  })
  .strict();

export const DependencyRefSchema = z
  .object({
    type: DependencyTypeSchema,
    target: StableIdSchema,
    direction: DependencyDirectionSchema,
    criticality: DependencyCriticalitySchema,
    reason: z.string().min(1).max(240).optional()
  })
  .strict();

export const CostRefSchema = z
  .object({
    owner: ReferenceValueSchema
  })
  .strict();

export const RetirementSchema = z
  .object({
    status: z.enum(["none", "planned", "retiring", "retired"]),
    note: z.string().min(1).max(500).optional()
  })
  .strict();

export const ManifestMetadataSchema = z
  .object({
    lastReviewedAt: DateOnlySchema,
    annotations: z.record(z.string().min(1).max(120), z.string().max(500)).optional()
  })
  .strict();

export const ServiceExtensionsSchema = z.record(z.string().min(1).max(80), z.unknown());

const ServiceManifestObjectSchema = z
  .object({
    schemaVersion: z.literal(SERVICE_MANIFEST_SCHEMA_VERSION),
    id: StableIdSchema,
    name: DisplayNameSchema,
    lifecycle: LifecycleSchema,
    owner: OwnerRefSchema,
    repository: RepositoryRefSchema,
    runtime: RuntimeProfileSchema,
    deploy: DeploymentProfileSchema,
    data: DataProfileSchema,
    dependencies: z.array(DependencyRefSchema).default([]),
    cost: CostRefSchema.optional(),
    retirement: RetirementSchema.optional(),
    metadata: ManifestMetadataSchema,
    extensions: ServiceExtensionsSchema.optional()
  })
  .strict();

export const ServiceManifestSchema = ServiceManifestObjectSchema.superRefine(addServiceIssues);

export const ServiceSourceSchema = z
  .object({
    path: RelativePathSchema
  })
  .strict();

export const ServiceRecordSchema = ServiceManifestObjectSchema.omit({ schemaVersion: true })
  .extend({
    source: ServiceSourceSchema
  })
  .superRefine(addServiceIssues);

function addServiceIssues(
  value: {
    lifecycle: z.infer<typeof LifecycleSchema>;
    retirement?: z.infer<typeof RetirementSchema>;
  },
  ctx: z.RefinementCtx
): void {
  addSecretLikeIssues(value, ctx);

  if (value.lifecycle === "retired" && value.retirement?.status !== "retired") {
    ctx.addIssue({
      code: "custom",
      path: ["retirement", "status"],
      message: "retired services require retirement.status: retired."
    });
  }
  if (value.retirement?.status === "retired" && value.lifecycle !== "retired") {
    ctx.addIssue({
      code: "custom",
      path: ["lifecycle"],
      message: "retirement.status: retired requires lifecycle: retired."
    });
  }
  if (value.retirement?.status === "retired" && !value.retirement.note) {
    ctx.addIssue({
      code: "custom",
      path: ["retirement", "note"],
      message: "retired services require a retirement note."
    });
  }
}

export type OwnerRef = z.infer<typeof OwnerRefSchema>;
export type RepositoryRef = z.infer<typeof RepositoryRefSchema>;
export type RuntimeProfile = z.infer<typeof RuntimeProfileSchema>;
export type DeployTarget = z.infer<typeof DeployTargetSchema>;
export type DeploymentProfile = z.infer<typeof DeploymentProfileSchema>;
export type DataProfile = z.infer<typeof DataProfileSchema>;
export type DependencyRef = z.infer<typeof DependencyRefSchema>;
export type ServiceManifest = z.infer<typeof ServiceManifestSchema>;
export type ServiceRecord = z.infer<typeof ServiceRecordSchema>;
export type ServiceExtensions = z.infer<typeof ServiceExtensionsSchema>;
