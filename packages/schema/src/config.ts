import { z } from "zod";
import { CATALOG_CONFIG_SCHEMA_VERSION, LEGACY_CATALOG_CONFIG_SCHEMA_VERSION } from "./versions.js";

const DEFAULT_EXCLUDE = [
  ".git/**",
  "node_modules/**",
  "dist/**",
  "coverage/**",
  ".catalog/**"
] as const;

export const CatalogInputSchemaSchema = z.enum(["scg-v1", "zdp-v2"]);

const CatalogConfigSchemaVersionSchema = z
  .union([
    z.literal(CATALOG_CONFIG_SCHEMA_VERSION),
    z.literal(LEGACY_CATALOG_CONFIG_SCHEMA_VERSION)
  ])
  .transform(() => CATALOG_CONFIG_SCHEMA_VERSION);

export const CATALOG_RESOURCE_LIMIT_DEFAULTS = {
  maxManifestBytes: 256 * 1024,
  maxTotalManifestBytes: 64 * 1024 * 1024,
  maxManifests: 1000,
  maxObjectDepth: 32,
  maxCollectionEntries: 100_000,
  maxExtensionBytes: 8 * 1024 * 1024,
  maxReportBytes: 64 * 1024 * 1024
} as const;

const ManifestNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isManifestFileName, "Manifest names must be filenames without path separators.");

const CatalogSourceSchema = z
  .object({
    root: z.string().trim().min(1),
    inputSchema: CatalogInputSchemaSchema,
    manifestNames: z.array(ManifestNameSchema).min(1).optional()
  })
  .strict();

const RawCatalogConfigSchema = z
  .object({
    schemaVersion: CatalogConfigSchemaVersionSchema,
    sources: z.array(CatalogSourceSchema).min(1).optional(),
    scan: z
      .object({
        roots: z.array(z.string().min(1)).optional(),
        manifestNames: z.array(ManifestNameSchema).optional(),
        exclude: z.array(z.string().min(1)).optional()
      })
      .strict()
      .optional(),
    validation: z
      .object({
        failOnWarnings: z.boolean().optional(),
        allowUnknownDependencies: z.boolean().optional(),
        staleAfterDays: z.number().int().positive().optional(),
        minimumServiceCount: z.number().int().nonnegative().max(10_000).optional()
      })
      .strict()
      .optional(),
    limits: z
      .object({
        maxManifestBytes: z.number().int().positive().optional(),
        maxTotalManifestBytes: z.number().int().positive().optional(),
        maxManifests: z.number().int().positive().max(10_000).optional(),
        maxObjectDepth: z.number().int().positive().max(256).optional(),
        maxCollectionEntries: z.number().int().positive().optional(),
        maxExtensionBytes: z.number().int().nonnegative().optional(),
        maxReportBytes: z.number().int().positive().optional()
      })
      .strict()
      .optional(),
    output: z
      .object({
        directory: z.string().min(1).optional(),
        formats: z.array(z.enum(["json", "dot", "html"])).optional()
      })
      .strict()
      .optional(),
    privacy: z
      .object({
        redactRepositoryUrls: z.boolean().optional(),
        redactOwnerEmails: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((config, context) => {
    if (!config.sources) {
      return;
    }

    if (config.scan?.roots !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["scan", "roots"],
        message: "scan.roots cannot be combined with sources."
      });
    }
    if (config.scan?.manifestNames !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["scan", "manifestNames"],
        message: "scan.manifestNames cannot be combined with sources."
      });
    }

    const normalizedRoots: Array<{ index: number; root: string }> = [];
    for (const [index, source] of config.sources.entries()) {
      const normalizedRoot = normalizeRelativeSourceRoot(source.root);
      if (!normalizedRoot) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "root"],
          message: "Source roots must be workspace-relative and remain inside the workspace."
        });
        continue;
      }
      normalizedRoots.push({ index, root: normalizedRoot });
    }

    const sortedRoots = normalizedRoots.sort(
      (left, right) => comparePathHierarchy(left.root, right.root) || left.index - right.index
    );
    for (let index = 1; index < sortedRoots.length; index += 1) {
      const left = sortedRoots[index - 1];
      const right = sortedRoots[index];
      if (!sourceRootsOverlap(left.root, right.root)) {
        continue;
      }
      context.addIssue({
        code: "custom",
        path: ["sources", right.index, "root"],
        message: `Source root overlaps sources.${left.index}.root after lexical normalization.`
      });
    }
  });

const NormalizedCatalogConfigSchema = z
  .object({
    schemaVersion: z.literal(CATALOG_CONFIG_SCHEMA_VERSION),
    sources: z
      .array(
        z.object({
          root: z.string(),
          inputSchema: CatalogInputSchemaSchema,
          manifestNames: z.array(z.string())
        })
      )
      .optional(),
    scan: z.object({
      roots: z.array(z.string()),
      manifestNames: z.array(z.string()),
      exclude: z.array(z.string())
    }),
    validation: z.object({
      failOnWarnings: z.boolean(),
      allowUnknownDependencies: z.boolean(),
      staleAfterDays: z.number(),
      minimumServiceCount: z.number()
    }),
    limits: z.object({
      maxManifestBytes: z.number(),
      maxTotalManifestBytes: z.number(),
      maxManifests: z.number(),
      maxObjectDepth: z.number(),
      maxCollectionEntries: z.number(),
      maxExtensionBytes: z.number(),
      maxReportBytes: z.number()
    }),
    output: z.object({
      directory: z.string(),
      formats: z.array(z.enum(["json", "dot", "html"]))
    }),
    privacy: z.object({
      redactRepositoryUrls: z.boolean(),
      redactOwnerEmails: z.boolean()
    })
  })
  .superRefine((config, context) => {
    if (config.validation.minimumServiceCount > config.limits.maxManifests) {
      context.addIssue({
        code: "custom",
        path: ["validation", "minimumServiceCount"],
        message: "minimumServiceCount must not exceed limits.maxManifests."
      });
    }
  });

export const CatalogConfigSchema = RawCatalogConfigSchema.transform((config) => ({
  schemaVersion: config.schemaVersion,
  ...(config.sources
    ? {
        sources: config.sources.map((source) => ({
          ...source,
          root: normalizeRelativeSourceRoot(source.root) ?? source.root,
          manifestNames: source.manifestNames ?? ["service.yaml"]
        }))
      }
    : {}),
  scan: {
    roots: config.scan?.roots ?? ["."],
    manifestNames: config.scan?.manifestNames ?? ["service.yaml"],
    exclude: config.scan?.exclude ?? [...DEFAULT_EXCLUDE]
  },
  validation: {
    failOnWarnings: config.validation?.failOnWarnings ?? false,
    allowUnknownDependencies: config.validation?.allowUnknownDependencies ?? false,
    staleAfterDays: config.validation?.staleAfterDays ?? 90,
    minimumServiceCount: config.validation?.minimumServiceCount ?? 0
  },
  limits: {
    maxManifestBytes:
      config.limits?.maxManifestBytes ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxManifestBytes,
    maxTotalManifestBytes:
      config.limits?.maxTotalManifestBytes ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxTotalManifestBytes,
    maxManifests: config.limits?.maxManifests ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxManifests,
    maxObjectDepth: config.limits?.maxObjectDepth ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxObjectDepth,
    maxCollectionEntries:
      config.limits?.maxCollectionEntries ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxCollectionEntries,
    maxExtensionBytes:
      config.limits?.maxExtensionBytes ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxExtensionBytes,
    maxReportBytes: config.limits?.maxReportBytes ?? CATALOG_RESOURCE_LIMIT_DEFAULTS.maxReportBytes
  },
  output: {
    directory: config.output?.directory ?? ".catalog",
    formats: config.output?.formats ?? ["json", "dot", "html"]
  },
  privacy: {
    redactRepositoryUrls: config.privacy?.redactRepositoryUrls ?? false,
    redactOwnerEmails: config.privacy?.redactOwnerEmails ?? true
  }
})).pipe(NormalizedCatalogConfigSchema);

function normalizeRelativeSourceRoot(root: string): string | undefined {
  const normalizedSeparators = root.replaceAll("\\", "/");
  if (
    normalizedSeparators.includes("\0") ||
    normalizedSeparators.startsWith("/") ||
    /^[A-Za-z]:/.test(normalizedSeparators)
  ) {
    return undefined;
  }

  const segments: string[] = [];
  for (const segment of normalizedSeparators.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return undefined;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join("/") || ".";
}

function isManifestFileName(value: string): boolean {
  return value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");
}

function sourceRootsOverlap(left: string, right: string): boolean {
  return (
    left === "." ||
    right === "." ||
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function comparePathHierarchy(left: string, right: string): number {
  const leftSegments = left === "." ? [] : left.split("/");
  const rightSegments = right === "." ? [] : right.split("/");
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (leftSegments[index] === rightSegments[index]) {
      continue;
    }
    return leftSegments[index] < rightSegments[index] ? -1 : 1;
  }

  return leftSegments.length - rightSegments.length;
}

export type CatalogConfig = z.output<typeof CatalogConfigSchema>;
export type CatalogConfigInput = z.input<typeof CatalogConfigSchema>;
export type CatalogInputSchema = z.infer<typeof CatalogInputSchemaSchema>;
