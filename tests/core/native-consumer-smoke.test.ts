import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";
import type { CatalogConfigInput } from "../../packages/core/src/types.js";
import { parse } from "yaml";

describe("native scg-v1 consumer fixture", () => {
  it("compiles the independent consumer config and dependency graph", async () => {
    const cwd = resolve("examples/native-consumer");
    const config = parse(
      await readFile(resolve(cwd, "scg.config.yaml"), "utf8")
    ) as CatalogConfigInput;
    const result = await compileCatalog({
      cwd,
      config,
      now: new Date("2026-07-13T00:00:00.000Z")
    });

    expect(result.snapshot.summary).toEqual({
      serviceCount: 2,
      errorCount: 0,
      warningCount: 0,
      edgeCount: 1
    });
    expect(result.snapshot.services.map((service) => service.id)).toEqual([
      "auth-api",
      "billing-api"
    ]);
    expect(result.snapshot.graph.edges).toEqual([
      expect.objectContaining({
        source: "billing-api",
        target: "auth-api",
        resolution: "catalog"
      })
    ]);
  });
});
