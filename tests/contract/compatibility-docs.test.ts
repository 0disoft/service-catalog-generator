import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stableDiagnosticCodes = [
  "adapter.invalid_input",
  "catalog.minimum_service_count",
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

  it("keeps the v1 migration and release-channel boundaries explicit", async () => {
    const migration = await readFile("docs/compatibility/pre-1.0-to-1.0.md", "utf8");

    expect(migration).toContain("Removing either alpha input alias requires a 2.0 release");
    expect(migration).toContain("Resource defaults may become more permissive");
    expect(migration).toContain("compare human prose or `.scg-*` recovery metadata");
    expect(migration).toContain("Schema selection remains explicit");
    expect(migration).toContain("Prereleases never move");
    expect(migration).toContain("npm `latest` and Action `v1` are stable channels");
  });
});
