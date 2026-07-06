import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { ServiceManifestSchema } from "../../packages/schema/src/index.js";

function loadFixture(name: string): unknown {
  const path = join(process.cwd(), "packages", "schema", "fixtures", name);
  return parse(readFileSync(path, "utf8"));
}

function issuePaths(result: ReturnType<typeof ServiceManifestSchema.safeParse>): string[] {
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("ServiceManifestSchema fixtures", () => {
  it.each(["valid-minimal.service.yaml", "valid-full.service.yaml"])("%s passes", (fixtureName) => {
    const result = ServiceManifestSchema.safeParse(loadFixture(fixtureName));
    expect(result.success).toBe(true);
  });

  it("rejects manifests without an owner", () => {
    const result = ServiceManifestSchema.safeParse(
      loadFixture("invalid-missing-owner.service.yaml")
    );
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("owner");
  });

  it("rejects unsupported schema versions", () => {
    const result = ServiceManifestSchema.safeParse(
      loadFixture("invalid-bad-schema-version.service.yaml")
    );
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("schemaVersion");
  });

  it("rejects secret-like annotations", () => {
    const result = ServiceManifestSchema.safeParse(
      loadFixture("invalid-secret-like-value.service.yaml")
    );
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("metadata.annotations.apiToken");
  });

  it("keeps unknown dependency resolution outside the schema package", () => {
    const result = ServiceManifestSchema.safeParse(
      loadFixture("invalid-unknown-dependency.service.yaml")
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.dependencies[0]?.target).toBe("ghost-api");
    }
  });
});
