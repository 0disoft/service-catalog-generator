import type { Diagnostic } from "@scg/schema";

type ConfigIssue = {
  code: string;
  path: PropertyKey[];
  message: string;
  keys?: string[];
  origin?: string;
};

export class CatalogConfigError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(issue: ConfigIssue) {
    const diagnostic = configIssueToDiagnostic(issue);
    super(diagnostic.message);
    this.name = "CatalogConfigError";
    this.diagnostic = diagnostic;
  }
}

export function configIssueToDiagnostic(issue: ConfigIssue): Diagnostic {
  const field = configIssueField(issue);
  return {
    severity: "error",
    code: "config.invalid",
    ...(field ? { field } : {}),
    message: configIssueMessage(issue, field),
    hint: configIssueHint(issue, field)
  };
}

function configIssueField(issue: ConfigIssue): string | undefined {
  const segments = issue.path.map(String);
  if (issue.code === "unrecognized_keys" && issue.keys?.[0]) {
    segments.push(issue.keys[0]);
  }
  return segments.length > 0 ? segments.join(".") : undefined;
}

function configIssueMessage(issue: ConfigIssue, field: string | undefined): string {
  if (issue.code === "custom") {
    return issue.message;
  }
  if (field === "schemaVersion") {
    return "Config schemaVersion is unsupported.";
  }
  if (field?.endsWith(".inputSchema")) {
    return "Input schema adapter is unsupported.";
  }
  if (issue.code === "unrecognized_keys") {
    return field
      ? `Config field ${field} is not supported.`
      : "Config contains unsupported fields.";
  }
  if (issue.code === "too_small" && field === "sources") {
    return "sources must contain at least one entry.";
  }
  if (issue.code === "too_small" && field?.endsWith(".manifestNames")) {
    return "manifestNames must contain at least one filename.";
  }
  if (issue.code === "too_small" && field?.includes(".manifestNames.")) {
    return "Manifest names must not be empty.";
  }
  if (issue.code === "too_small" && field?.endsWith(".root")) {
    return "Source roots must not be empty.";
  }
  if (issue.code === "invalid_type") {
    return field ? `Config field ${field} has an invalid type.` : "Config has an invalid type.";
  }
  return field ? `Config field ${field} is invalid.` : "Config values are invalid.";
}

function configIssueHint(issue: ConfigIssue, field: string | undefined): string {
  if (field === "schemaVersion") {
    return "Use schemaVersion scg.config/v1alpha1.";
  }
  if (field?.endsWith(".inputSchema")) {
    return "Use scg-v1 or zdp-v2.";
  }
  if (issue.code === "unrecognized_keys") {
    return "Remove unsupported config fields; the config schema is strict.";
  }
  if (
    issue.code === "custom" &&
    field?.startsWith("scan.") &&
    issue.message.includes("cannot be combined with sources")
  ) {
    return "Remove legacy scan selectors when sources is configured.";
  }
  if (issue.code === "custom" && field?.endsWith(".root")) {
    return "Use non-overlapping workspace-relative source roots.";
  }
  if (field === "sources") {
    return "Add at least one source with root and inputSchema.";
  }
  if (field?.includes(".manifestNames")) {
    return "Provide at least one non-empty manifest filename or omit manifestNames for service.yaml.";
  }
  return field
    ? `Update ${field} to match the scg.config/v1alpha1 contract.`
    : "Use schemaVersion scg.config/v1alpha1 and supported config fields.";
}
