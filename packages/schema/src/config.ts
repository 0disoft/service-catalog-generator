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
        requireLastReviewedAt: z.boolean().default(true),
        staleAfterDays: z.number().int().positive().default(90)
      })
      .strict()
      .default({
        failOnWarnings: false,
        allowUnknownDependencies: false,
        requireLastReviewedAt: true,
        staleAfterDays: 90
      }),
    output: z
      .object({
        directory: z.string().min(1).default(".catalog"),
        formats: z.array(z.enum(["json", "dot", "html"])).default(["json", "dot", "html"]),
        deterministic: z.boolean().default(true)
      })
      .strict()
      .default({
        directory: ".catalog",
        formats: ["json", "dot", "html"],
        deterministic: true
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
  .strict();

export type CatalogConfig = z.infer<typeof CatalogConfigSchema>;
