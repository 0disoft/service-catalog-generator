import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";
import type { CatalogConfigInput } from "../../packages/core/src/types.js";
import { CatalogConfigSchema } from "../../packages/schema/src/index.js";

const cleanupRoots: string[] = [];
const scanBudgetManifestCount = 500;
const memoryBudgetManifestCount = 1000;
const sourceValidationCount = 5000;
const sourceResolutionCount = 100;
const mixedSourceCount = 20;
const hostedRunnerBudgetMs = 5000;
const localFilesystemBudgetMs = 15000;
const memoryBudgetBytes = 256 * 1024 * 1024;
const manifestWriteConcurrency = 50;
const testHarnessTimeoutMs = 30000;
const memoryHarnessTimeoutMs = 60000;

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("core catalog compiler performance", () => {
  it("bounds repeated recursive glob matching", async () => {
    const workspace = await createWorkspace();
    const nestedPath = `${Array.from({ length: 20 }, (_, index) => `level-${index}`).join("/")}/service.yaml`;
    await writeManifest(workspace, nestedPath, serviceYaml("deep-service"));
    const repeatedRecursivePattern = `${Array.from({ length: 10 }, () => "**").join("/")}/never-match`;

    const startedAt = performance.now();
    const result = await compileCatalog({
      cwd: workspace,
      config: {
        scan: {
          exclude: [repeatedRecursivePattern]
        }
      }
    });
    const elapsedMs = performance.now() - startedAt;

    expect(result.snapshot.summary.serviceCount).toBe(1);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it(
    "scans 500 manifests within the hosted-runner budget",
    async () => {
      const workspace = await createWorkspaceWithManifests(scanBudgetManifestCount);

      const startedAt = performance.now();
      const result = await compileCatalog({
        cwd: workspace,
        now: new Date("2026-07-07T00:00:00Z")
      });
      const elapsedMs = performance.now() - startedAt;

      expect(result.snapshot.summary.serviceCount).toBe(scanBudgetManifestCount);
      expect(result.snapshot.summary.errorCount).toBe(0);
      expect(result.snapshot.summary.warningCount).toBe(0);
      expect(elapsedMs).toBeLessThan(scanBudgetMs());
    },
    testHarnessTimeoutMs
  );

  it(
    "scans 1000 manifests within the peak memory budget",
    async () => {
      const workspace = await createWorkspaceWithManifests(memoryBudgetManifestCount);
      const memorySampler = samplePeakRss();

      try {
        const result = await compileCatalog({
          cwd: workspace,
          now: new Date("2026-07-07T00:00:00Z")
        });
        const peakRss = memorySampler.stop();

        expect(result.snapshot.summary.serviceCount).toBe(memoryBudgetManifestCount);
        expect(result.snapshot.summary.errorCount).toBe(0);
        expect(result.snapshot.summary.warningCount).toBe(0);
        expect(peakRss).toBeLessThan(memoryBudgetBytes);
      } finally {
        memorySampler.stop();
      }
    },
    memoryHarnessTimeoutMs
  );

  it("validates 5000 disjoint source declarations without quadratic overlap work", () => {
    const sources = Array.from({ length: sourceValidationCount }, (_, index) => ({
      root: `source-${index.toString().padStart(5, "0")}`,
      inputSchema: index % 2 === 0 ? ("scg-v1" as const) : ("zdp-v2" as const)
    }));

    const startedAt = performance.now();
    const result = CatalogConfigSchema.safeParse({
      schemaVersion: "scg.config/v1",
      sources
    });
    const elapsedMs = performance.now() - startedAt;

    expect(result.success).toBe(true);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it(
    "resolves and scans 100 disjoint mixed source roots within the scan budget",
    async () => {
      const fixture = await createWorkspaceWithMixedSources(
        sourceResolutionCount,
        sourceResolutionCount
      );

      const startedAt = performance.now();
      const result = await compileCatalog({
        cwd: fixture.workspace,
        config: fixture.config,
        now: new Date("2026-07-07T00:00:00Z")
      });
      const elapsedMs = performance.now() - startedAt;

      expect(result.snapshot.summary).toMatchObject({
        serviceCount: sourceResolutionCount,
        errorCount: 0,
        warningCount: 0
      });
      expect(elapsedMs).toBeLessThan(scanBudgetMs());
    },
    testHarnessTimeoutMs
  );

  it(
    "scans 500 manifests across mixed source adapters within the hosted-runner budget",
    async () => {
      const fixture = await createWorkspaceWithMixedSources(
        scanBudgetManifestCount,
        mixedSourceCount
      );

      const startedAt = performance.now();
      const result = await compileCatalog({
        cwd: fixture.workspace,
        config: fixture.config,
        now: new Date("2026-07-07T00:00:00Z")
      });
      const elapsedMs = performance.now() - startedAt;

      expect(result.snapshot.summary).toMatchObject({
        serviceCount: scanBudgetManifestCount,
        errorCount: 0,
        warningCount: 0
      });
      expect(elapsedMs).toBeLessThan(scanBudgetMs());
    },
    testHarnessTimeoutMs
  );

  it(
    "scans 1000 mixed manifests within the peak memory budget",
    async () => {
      const fixture = await createWorkspaceWithMixedSources(
        memoryBudgetManifestCount,
        mixedSourceCount
      );
      const memorySampler = samplePeakRss();

      try {
        const result = await compileCatalog({
          cwd: fixture.workspace,
          config: fixture.config,
          now: new Date("2026-07-07T00:00:00Z")
        });
        const peakRss = memorySampler.stop();

        expect(result.snapshot.summary).toMatchObject({
          serviceCount: memoryBudgetManifestCount,
          errorCount: 0,
          warningCount: 0
        });
        expect(peakRss).toBeLessThan(memoryBudgetBytes);
      } finally {
        memorySampler.stop();
      }
    },
    memoryHarnessTimeoutMs
  );
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-performance-"));
  cleanupRoots.push(root);
  return root;
}

async function createWorkspaceWithManifests(manifestCount: number): Promise<string> {
  const workspace = await createWorkspace();
  for (let start = 0; start < manifestCount; start += manifestWriteConcurrency) {
    const batch = Array.from(
      { length: Math.min(manifestWriteConcurrency, manifestCount - start) },
      (_, offset) => start + offset
    );
    await Promise.all(
      batch.map(async (index) => {
        const id = `service-${index.toString().padStart(4, "0")}`;
        await writeManifest(workspace, `services/${id}/service.yaml`, serviceYaml(id));
      })
    );
  }
  return workspace;
}

async function createWorkspaceWithMixedSources(
  manifestCount: number,
  sourceCount: number
): Promise<{ workspace: string; config: CatalogConfigInput }> {
  const workspace = await createWorkspace();
  const sources = Array.from({ length: sourceCount }, (_, index) => ({
    root: `sources/source-${index.toString().padStart(3, "0")}`,
    inputSchema: index % 2 === 0 ? ("scg-v1" as const) : ("zdp-v2" as const)
  }));
  await Promise.all(
    sources.map((source) => mkdir(join(workspace, source.root), { recursive: true }))
  );

  for (let start = 0; start < manifestCount; start += manifestWriteConcurrency) {
    const batch = Array.from(
      { length: Math.min(manifestWriteConcurrency, manifestCount - start) },
      (_, offset) => start + offset
    );
    await Promise.all(
      batch.map(async (index) => {
        const sourceIndex = index % sourceCount;
        const id = `mixed-service-${index.toString().padStart(4, "0")}`;
        const source = sources[sourceIndex];
        await writeManifest(
          workspace,
          `${source.root}/${id}/service.yaml`,
          source.inputSchema === "scg-v1" ? serviceYaml(id) : zdpServiceYaml(id)
        );
      })
    );
  }

  return {
    workspace,
    config: {
      sources,
      limits: { maxManifests: Math.max(1000, manifestCount) }
    }
  };
}

async function writeManifest(
  workspace: string,
  relativePath: string,
  contents: string
): Promise<void> {
  const absolutePath = join(workspace, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
}

function samplePeakRss(): {
  stop: () => number;
} {
  let peakRss = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 5);

  return {
    stop: () => {
      clearInterval(sampler);
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      return peakRss;
    }
  };
}

function scanBudgetMs(): number {
  return process.env.CI === "true" ? hostedRunnerBudgetMs : localFilesystemBudgetMs;
}

function serviceYaml(id: string): string {
  return [
    "schemaVersion: scg.service/v1",
    `id: ${id}`,
    `name: ${id}`,
    "lifecycle: production",
    "owner:",
    "  type: team",
    "  ref: team:platform",
    "repository:",
    "  provider: github",
    `  slug: example/${id}`,
    "runtime:",
    "  language: typescript",
    "  platform: node",
    "deploy:",
    "  type: container",
    "  targets:",
    "    - environment: production",
    "      provider: unknown",
    `      ref: ${id}-prod`,
    "data:",
    "  storesPersonalData: false",
    "  classification: internal",
    "dependencies:",
    "  []",
    "metadata:",
    '  lastReviewedAt: "2026-07-07"'
  ].join("\n");
}

function zdpServiceYaml(id: string): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    '  last_reviewed_at: "2026-07-07"',
    "service:",
    `  id: ${id}`,
    `  display_name: ${id}`,
    "  owner: 0disoft",
    `  repo: ${id}`,
    "  status: experiment",
    "  tier: tier2",
    "  risk_level: low",
    "lifecycle:",
    "  stage: foundation",
    "domain:",
    "  type: platform",
    "  user_facing: false",
    "  public_api: false",
    "  money_movement: false",
    "runtime:",
    "  core: node",
    "  framework: typescript",
    "cost:",
    `  cost_center: ${id}`,
    "  owner: 0disoft",
    "data:",
    "  pii_level: none",
    "  payment_data: false",
    "  message_content: false",
    "  ai_user_data: false",
    "dependencies:",
    "  services: []",
    "  datastores: []",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}
