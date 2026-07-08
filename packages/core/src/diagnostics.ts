import type { Diagnostic } from "@scg/schema";

const severityRank: Record<Diagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2
};

type SchemaIssue = {
  code: string;
  path: Array<PropertyKey>;
  message: string;
};

export function createDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return diagnostic;
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }

    return compareStrings(
      left.file ?? "",
      right.file ?? "",
      left.field ?? "",
      right.field ?? "",
      left.code,
      right.code,
      left.message,
      right.message
    );
  });
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): {
  errorCount: number;
  warningCount: number;
} {
  return diagnostics.reduce(
    (summary, diagnostic) => {
      if (diagnostic.severity === "error") {
        summary.errorCount += 1;
      }
      if (diagnostic.severity === "warning") {
        summary.warningCount += 1;
      }
      return summary;
    },
    { errorCount: 0, warningCount: 0 }
  );
}

export function schemaIssueToDiagnostic(issue: SchemaIssue, file: string): Diagnostic {
  const field = schemaIssueField(issue);
  const code = schemaIssueCode(issue, field);

  return createDiagnostic({
    severity: "error",
    code,
    file,
    ...(field ? { field } : {}),
    message: schemaIssueMessage(code, field),
    hint: schemaIssueHint(code, field)
  });
}

function schemaIssueField(issue: SchemaIssue): string | undefined {
  if (issue.path.length === 0) {
    return undefined;
  }
  return issue.path.map(String).join(".");
}

function schemaIssueCode(issue: SchemaIssue, field: string | undefined): Diagnostic["code"] {
  if (field === "schemaVersion") {
    return "manifest.invalid_schema_version";
  }

  if (issue.message.toLowerCase().includes("secret-like")) {
    return "security.secret_like_value";
  }

  if (
    issue.code === "invalid_type" &&
    (issue.message.toLowerCase().includes("required") ||
      issue.message.toLowerCase().includes("undefined"))
  ) {
    return "manifest.missing_required_field";
  }

  if (issue.code === "invalid_type") {
    return "manifest.invalid_type";
  }

  if (
    issue.code === "invalid_enum_value" ||
    issue.code === "invalid_literal" ||
    issue.code === "unrecognized_keys"
  ) {
    return "manifest.invalid_value";
  }

  if (
    issue.code === "invalid_string" ||
    issue.code === "too_small" ||
    issue.code === "too_big" ||
    issue.code === "custom"
  ) {
    return "manifest.invalid_format";
  }

  return "manifest.missing_required_field";
}

function schemaIssueMessage(code: Diagnostic["code"], field: string | undefined): string {
  if (code === "manifest.invalid_schema_version") {
    return "Manifest schemaVersion is unsupported.";
  }

  if (code === "security.secret_like_value") {
    return "Manifest contains secret-like data.";
  }

  if (field) {
    return `Manifest field ${field} is missing or invalid.`;
  }

  return "Manifest shape is invalid.";
}

function schemaIssueHint(code: Diagnostic["code"], field: string | undefined): string {
  if (code === "manifest.invalid_schema_version") {
    return "Use schemaVersion scg.service/v1alpha1.";
  }

  if (code === "security.secret_like_value") {
    return "Remove credentials, tokens, private keys, and secret-like annotations from the manifest.";
  }

  if (field) {
    return `Update ${field} in service.yaml to match the service manifest contract.`;
  }

  return "Update service.yaml to match the service manifest contract.";
}

function compareStrings(...values: string[]): number {
  for (let index = 0; index < values.length; index += 2) {
    const left = values[index] ?? "";
    const right = values[index + 1] ?? "";
    const comparison = left.localeCompare(right);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}
