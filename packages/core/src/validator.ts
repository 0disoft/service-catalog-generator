import { ServiceManifestSchema, type Diagnostic } from "@scg/schema";
import { adaptParsedManifest } from "./adapters.js";
import { createDiagnostic, schemaIssueToDiagnostic } from "./diagnostics.js";
import type { InputSchema, ParsedManifest, ServiceDependency, ValidatedManifest } from "./types.js";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function validateParsedManifest(
  parsed: ParsedManifest,
  inputSchema: InputSchema = "scg-v1"
): ValidatedManifest {
  if (!parsed.ok) {
    return parsed;
  }

  const adapted = adaptParsedManifest(parsed, inputSchema);
  if (!adapted.ok) {
    return {
      ok: false,
      file: parsed.file,
      diagnostics: adapted.diagnostics
    };
  }

  const result = ServiceManifestSchema.safeParse(adapted.value);
  if (!result.success) {
    return {
      ok: false,
      file: parsed.file,
      diagnostics: result.error.issues.map((issue) =>
        schemaIssueToDiagnostic(issue, parsed.file.relativePath)
      )
    };
  }

  return {
    ok: true,
    file: parsed.file,
    manifest: result.data
  };
}

export function staleReviewDiagnostic(
  file: string,
  lastReviewedAt: string,
  now: Date,
  staleAfterDays: number
): Diagnostic | undefined {
  const reviewedAt = parseDateOnly(lastReviewedAt);
  if (!reviewedAt) {
    return undefined;
  }

  const elapsedDays = Math.floor((now.getTime() - reviewedAt.getTime()) / DAY_IN_MILLISECONDS);
  if (elapsedDays <= staleAfterDays) {
    return undefined;
  }

  return createDiagnostic({
    severity: "warning",
    code: "metadata.stale_review",
    file,
    field: "metadata.lastReviewedAt",
    message: "Manifest review date is older than policy.",
    hint: "Update metadata.lastReviewedAt after verifying the service metadata."
  });
}

export function unknownDependencyDiagnostics(
  sourceId: string,
  sourceFile: string,
  dependencies: ServiceDependency[],
  knownServiceIds: Set<string>,
  allowUnknownDependencies: boolean
): Diagnostic[] {
  if (allowUnknownDependencies) {
    return [];
  }

  return dependencies
    .map((dependency, index) => ({ dependency, index }))
    .filter(
      ({ dependency }) => dependency.type === "service" && !knownServiceIds.has(dependency.target)
    )
    .map(({ dependency, index }) =>
      createDiagnostic({
        severity: "error",
        code: "dependency.unknown_target",
        file: sourceFile,
        field: `dependencies.${index}.target`,
        message: `Service ${sourceId} depends on unknown service ${dependency.target}.`,
        hint: "Add a service.yaml for the target service or allow unknown dependencies in policy."
      })
    );
}

function parseDateOnly(value: string): Date | undefined {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day));
}
