import { z } from "zod";
import { CATALOG_CONFIG_SCHEMA_VERSION } from "./versions.js";

export const CatalogConfigSchema = z
  .object({
    schemaVersion: z.literal(CATALOG_CONFIG_SCHEMA_VERSION),
    scan: z
      .object({
        roots: z.array(z.string().min(1)).default(["."]),
        manifestNames: z.array(z.string().min(1)).default(["service.yaml"]),
        exclude: z
          .array(z.string().min(1))
          .default([".git/**", "node_modules/**", "dist/**", "coverage/**", ".catalog/**"])
      })
      .strict()
      .default({
        roots: ["."],
        manifestNames: ["service.yaml"],
        exclude: [".git/**", "node_modules/**", "dist/**", "coverage/**", ".catalog/**"]
      }),
    validation: z
      .object({
        failOnWarnings: z.boolean().default(false),
        allowUnknownDependencies: z.boolean().default(false),
        staleAfterDays: z.number().int().positive().default(90),
        minimumServiceCount: z.number().int().nonnegative().max(10_000).default(0)
      })
      .strict()
      .default({
        failOnWarnings: false,
        allowUnknownDependencies: false,
        staleAfterDays: 90,
        minimumServiceCount: 0
      }),
    limits: z
      .object({
        maxManifestBytes: z
          .number()
          .int()
          .positive()
          .default(256 * 1024),
        maxTotalManifestBytes: z
          .number()
          .int()
          .positive()
          .default(64 * 1024 * 1024),
        maxManifests: z.number().int().positive().max(10_000).default(1000),
        maxObjectDepth: z.number().int().positive().max(256).default(32),
        maxCollectionEntries: z.number().int().positive().default(100_000),
        maxExtensionBytes: z
          .number()
          .int()
          .nonnegative()
          .default(8 * 1024 * 1024),
        maxReportBytes: z
          .number()
          .int()
          .positive()
          .default(64 * 1024 * 1024)
      })
      .strict()
      .default({
        maxManifestBytes: 256 * 1024,
        maxTotalManifestBytes: 64 * 1024 * 1024,
        maxManifests: 1000,
        maxObjectDepth: 32,
        maxCollectionEntries: 100_000,
        maxExtensionBytes: 8 * 1024 * 1024,
        maxReportBytes: 64 * 1024 * 1024
      }),
    output: z
      .object({
        directory: z.string().min(1).default(".catalog"),
        formats: z.array(z.enum(["json", "dot", "html"])).default(["json", "dot", "html"])
      })
      .strict()
      .default({
        directory: ".catalog",
        formats: ["json", "dot", "html"]
      }),
    privacy: z
      .object({
        redactRepositoryUrls: z.boolean().default(false),
        redactOwnerEmails: z.boolean().default(true)
      })
      .strict()
      .default({
        redactRepositoryUrls: false,
        redactOwnerEmails: true
      })
  })
  .strict()
  .superRefine((config, context) => {
    if (config.validation.minimumServiceCount > config.limits.maxManifests) {
      context.addIssue({
        code: "custom",
        path: ["validation", "minimumServiceCount"],
        message: "minimumServiceCount must not exceed limits.maxManifests."
      });
    }
  });

export type CatalogConfig = z.infer<typeof CatalogConfigSchema>;
