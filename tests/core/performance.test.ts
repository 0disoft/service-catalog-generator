import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";

const cleanupRoots: string[] = [];
const scanBudgetManifestCount = 500;
const memoryBudgetManifestCount = 1000;
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
    "schemaVersion: scg.service/v1alpha1",
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
