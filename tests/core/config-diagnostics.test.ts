import { describe, expect, it } from "vitest";
import { configIssueToDiagnostic } from "../../packages/core/src/index.js";

describe("config diagnostics", () => {
  it("maps unsupported adapters without echoing raw issue values", () => {
    const diagnostic = configIssueToDiagnostic({
      code: "invalid_value",
      path: ["sources", 0, "inputSchema"],
      message: "Invalid option super-secret-adapter"
    });

    expect(diagnostic).toEqual({
      severity: "error",
      code: "config.invalid",
      field: "sources.0.inputSchema",
      message: "Input schema adapter is unsupported.",
      hint: "Use scg-v1 or zdp-v2."
    });
    expect(JSON.stringify(diagnostic)).not.toContain("super-secret-adapter");
  });

  it("adds strict unknown keys to the diagnostic field", () => {
    expect(
      configIssueToDiagnostic({
        code: "unrecognized_keys",
        path: ["validation"],
        keys: ["unknownPolicy"],
        message: "Unrecognized key"
      })
    ).toEqual({
      severity: "error",
      code: "config.invalid",
      field: "validation.unknownPolicy",
      message: "Config field validation.unknownPolicy is not supported.",
      hint: "Remove unsupported config fields; the config schema is strict."
    });
  });

  it("preserves schema-owned overlap decisions with a bounded remediation", () => {
    expect(
      configIssueToDiagnostic({
        code: "custom",
        path: ["sources", 1, "root"],
        message: "Source root overlaps sources.0.root after lexical normalization."
      })
    ).toEqual({
      severity: "error",
      code: "config.invalid",
      field: "sources.1.root",
      message: "Source root overlaps sources.0.root after lexical normalization.",
      hint: "Use non-overlapping workspace-relative source roots."
    });
  });
});
