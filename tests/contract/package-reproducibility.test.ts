import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("package reproducibility contract", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "pack-smoke.mjs"), "utf8");

  it("packs twice and compares complete tarball SHA-256 digests", () => {
    expect(source.match(/\bpack\(/g)).toHaveLength(3);
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain("firstHash === secondHash");
    expect(source).toContain("repeated package builds are not reproducible");
  });

  it("runs consumer conformance against the verified tarball", () => {
    expect(source).toContain("packageSpec: firstTarballPath");
    expect(source).toContain("runExternalConsumerConformance");
    expect(source).toContain("sha256=${firstHash}");
  });
});
