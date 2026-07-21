import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("monorepo consumer example", () => {
  const root = join(process.cwd(), "examples", "monorepo-consumer");
  const config = parse(readFileSync(join(root, "scg.config.yaml"), "utf8")) as {
    sources: Array<{ root: string; inputSchema: string; manifestNames: string[] }>;
  };
  const conformance = JSON.parse(
    readFileSync(join(process.cwd(), "examples", "consumer-conformance.json"), "utf8")
  ) as { cases: Array<{ id: string; cwd: string; config: string }> };

  it("declares disjoint app and platform roots with different manifest names", () => {
    expect(config.sources).toEqual([
      { root: "apps", inputSchema: "scg-v1", manifestNames: ["catalog.yaml"] },
      { root: "platform", inputSchema: "scg-v1", manifestNames: ["service.yaml"] }
    ]);
  });

  it("is executed by the shared built-CLI conformance path", () => {
    expect(conformance.cases).toContainEqual(
      expect.objectContaining({
        id: "monorepo-source-roots",
        cwd: "examples/monorepo-consumer",
        config: "scg.config.yaml"
      })
    );
  });
});
