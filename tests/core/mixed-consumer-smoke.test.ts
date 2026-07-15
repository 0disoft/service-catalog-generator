import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { compileCatalog } from "../../packages/core/src/index.js";
import type { CatalogConfigInput } from "../../packages/core/src/types.js";

describe("mixed adapter consumer fixture", () => {
  it("compiles one catalog and resolves its cross-source dependency", async () => {
    const cwd = process.cwd();
    const configPath = resolve(cwd, "examples/mixed-consumer/scg.config.yaml");
    const config = parse(await readFile(configPath, "utf8")) as CatalogConfigInput;
    const result = await compileCatalog({
      cwd,
      config,
      now: new Date("2026-07-15T00:00:00.000Z")
    });

    expect(result.snapshot.summary).toEqual({
      serviceCount: 2,
      errorCount: 0,
      warningCount: 0,
      edgeCount: 1
    });
    expect(result.snapshot.services.map((service) => service.id)).toEqual([
      "billing-api",
      "platform-runtime"
    ]);
    expect(result.snapshot.graph.edges).toEqual([
      expect.objectContaining({
        source: "billing-api",
        target: "platform-runtime",
        resolution: "catalog"
      })
    ]);
    expect(result.discoveredManifests.map((manifest) => manifest.inputSchema)).toEqual([
      "scg-v1",
      "zdp-v2"
    ]);
  });
});
