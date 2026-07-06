import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageNames = ["schema", "core", "cli", "report", "action"] as const;

type WorkspacePackage = {
  name: string;
  private: boolean;
  type: string;
};

describe("workspace package contract", () => {
  it("keeps internal packages private and under the @scg boundary", () => {
    for (const packageName of packageNames) {
      const content = readFileSync(
        join(process.cwd(), "packages", packageName, "package.json"),
        "utf8"
      );
      const pkg = JSON.parse(content) as WorkspacePackage;

      expect(pkg.name).toBe(`@scg/${packageName}`);
      expect(pkg.private).toBe(true);
      expect(pkg.type).toBe("module");
    }
  });
});
