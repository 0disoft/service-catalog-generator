import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const baseline = JSON.parse(await readFile("contracts/compatibility-v1.json", "utf8")) as {
  diagnosticCodes: string[];
};

describe("1.0 compatibility documentation", () => {
  it("classifies public and internal surfaces and inventories stable diagnostic codes", async () => {
    const matrix = await readFile("docs/compatibility/1.0-contract-matrix.md", "utf8");

    expect(matrix).toContain("`stable`");
    expect(matrix).toContain("`experimental`");
    expect(matrix).toContain("`internal`");
    expect(matrix).toContain("`.scg-generation.json` contents | internal");
    for (const code of baseline.diagnosticCodes) {
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

  it("keeps support, deprecation, and fail-on-warning compatibility explicit", async () => {
    const policy = await readFile("docs/compatibility/1.x-support-policy.md", "utf8");
    const security = await readFile("SECURITY.md", "utf8");
    const normalizedPolicy = policy.replace(/\s+/g, " ");

    expect(normalizedPolicy).toContain("latest stable `1.x`");
    expect(normalizedPolicy).toContain("do not receive routine backports");
    expect(normalizedPolicy).toContain("No 1.x end-of-support date is scheduled");
    expect(normalizedPolicy).toContain("must not start failing under `--fail-on-warning`");
    expect(normalizedPolicy).toContain(
      "Published npm versions and immutable Git tags are never rewritten"
    );
    expect(security).toContain("latest stable `1.x`");
    expect(security).toContain("Advisory-specific only");
  });
});
