import { z } from "zod";
import { DiagnosticCodeSchema, DiagnosticSeveritySchema, RelativePathSchema } from "./shared.js";

export const DiagnosticSchema = z
  .object({
    severity: DiagnosticSeveritySchema,
    code: DiagnosticCodeSchema,
    file: RelativePathSchema.optional(),
    field: z.string().min(1).max(240).optional(),
    message: z.string().min(1).max(500),
    hint: z.string().min(1).max(500).optional()
  })
  .strict();

export type Diagnostic = z.infer<typeof DiagnosticSchema>;
