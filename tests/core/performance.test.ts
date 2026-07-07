import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";

const cleanupRoots: string[] = [];
const manifestCount = 500;
const hostedRunnerBudgetMs = 5000;

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("core catalog compiler performance", () => {
  it("scans 500 manifests within the hosted-runner budget", async () => {
    const workspace = await createWorkspace();
    for (let index = 0; index < manifestCount; index += 1) {
      const id = `service-${index.toString().padStart(3, "0")}`;
      await writeManifest(workspace, `services/${id}/service.yaml`, serviceYaml(id));
    }

    const startedAt = performance.now();
    const result = await compileCatalog({ cwd: workspace, now: new Date("2026-07-07T00:00:00Z") });
    const elapsedMs = performance.now() - startedAt;

    expect(result.snapshot.summary.serviceCount).toBe(manifestCount);
    expect(result.snapshot.summary.errorCount).toBe(0);
    expect(result.snapshot.summary.warningCount).toBe(0);
    expect(elapsedMs).toBeLessThan(hostedRunnerBudgetMs);
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-performance-"));
  cleanupRoots.push(root);
  return root;
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
