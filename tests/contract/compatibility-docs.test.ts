import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stableDiagnosticCodes = [
  "adapter.invalid_input",
  "config.invalid",
  "dependency.unknown_target",
  "manifest.duplicate_id",
  "manifest.invalid",
  "manifest.invalid_format",
  "manifest.invalid_schema_version",
  "manifest.invalid_type",
  "manifest.invalid_value",
  "manifest.invalid_yaml",
  "manifest.missing_required_field",
  "metadata.future_review",
  "metadata.stale_review",
  "output.write_failed",
  "path.outside_scan_root",
  "resource.limit_exceeded",
  "security.secret_like_value"
];

describe("1.0 compatibility documentation", () => {
  it("classifies public and internal surfaces and inventories stable diagnostic codes", async () => {
    const matrix = await readFile("docs/compatibility/1.0-contract-matrix.md", "utf8");

    expect(matrix).toContain("`stable`");
    expect(matrix).toContain("`experimental`");
    expect(matrix).toContain("`internal`");
    expect(matrix).toContain("`.scg-generation.json` contents | internal");
    for (const code of stableDiagnosticCodes) {
      expect(matrix).toContain(`\`${code}\``);
    }
  });

  it("keeps migration rules for every compatibility class", async () => {
    const migration = await readFile("docs/compatibility/pre-1.0-to-1.0.md", "utf8");

    expect(migration).toContain("Stable surfaces receive a changelog entry");
    expect(migration).toContain("Experimental surfaces may change before 1.0");
    expect(migration).toContain("Internal surfaces may change without migration support");
    expect(migration).toContain("Schema selection remains explicit");
  });
});
