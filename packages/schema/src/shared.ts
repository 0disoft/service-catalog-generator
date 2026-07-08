import { z } from "zod";

export const StableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Use lowercase kebab-case ids.");

export const DisplayNameSchema = z.string().min(1).max(160);

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.")
  .refine(isCalendarDateOnly, "Use a valid calendar date.");

function isCalendarDateOnly(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const ReferenceValueSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9:-]*[a-z0-9]$/, "Use stable refs such as team:platform.")
  .refine((value) => !value.includes("@"), "Owner references must not be email addresses.");

export const LifecycleSchema = z.enum([
  "experimental",
  "development",
  "production",
  "deprecated",
  "retired"
]);

export const DataClassificationSchema = z.enum([
  "public",
  "internal",
  "restricted",
  "confidential"
]);

export const DependencyTypeSchema = z.enum(["service", "api", "database", "queue", "external"]);

export const DependencyDirectionSchema = z.enum(["inbound", "outbound", "bidirectional"]);

export const DependencyCriticalitySchema = z.enum(["required", "optional"]);

export const DiagnosticSeveritySchema = z.enum(["error", "warning", "info"]);

export const DiagnosticCodeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

export const RelativePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => !value.includes("\0"), "Paths must not contain NUL bytes.");
