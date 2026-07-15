import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";
import type { CatalogConfigInput } from "../../packages/core/src/types.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("source-scoped input adapters", () => {
  it("compiles mixed adapters into one catalog with cross-source dependency resolution", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "native/billing/service.yaml",
      nativeService("billing-api", "platform-runtime")
    );
    await writeManifest(workspace, "zdp/runtime/service.yaml", zdpService("platform-runtime"));

    const result = await compileCatalog({ cwd: workspace, config: sourceConfig() });

    expect(result.snapshot.summary).toMatchObject({
      serviceCount: 2,
      errorCount: 0,
      edgeCount: 1
    });
    expect(result.services.map((service) => service.id)).toEqual([
      "billing-api",
      "platform-runtime"
    ]);
    expect(result.graphEdges).toContainEqual(
      expect.objectContaining({
        source: "billing-api",
        target: "platform-runtime",
        resolution: "catalog"
      })
    );
    expect(result.discoveredManifests.map((manifest) => manifest.inputSchema)).toEqual([
      "scg-v1",
      "zdp-v2"
    ]);
  });

  it("produces identical output regardless of source declaration order", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/billing/service.yaml", nativeService("billing-api"));
    await writeManifest(workspace, "zdp/runtime/service.yaml", zdpService("platform-runtime"));
    const forward = sourceConfig();
    const reverse = { ...forward, sources: [...(forward.sources ?? [])].reverse() };

    const [forwardResult, reverseResult] = await Promise.all([
      compileCatalog({ cwd: workspace, config: forward }),
      compileCatalog({ cwd: workspace, config: reverse })
    ]);

    expect(reverseResult.snapshot).toEqual(forwardResult.snapshot);
    expect(reverseResult.discoveredManifests).toEqual(forwardResult.discoveredManifests);
  });

  it("isolates duplicate service ids across source adapters", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/shared/service.yaml", nativeService("shared-service"));
    await writeManifest(workspace, "zdp/shared/service.yaml", zdpService("shared-service"));

    const result = await compileCatalog({ cwd: workspace, config: sourceConfig() });

    expect(result.services).toEqual([]);
    expect(result.snapshot.summary.errorCount).toBe(3);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "manifest.duplicate_id")
    ).toHaveLength(2);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog.minimum_service_count" })
    );
  });

  it("rejects lexical-disjoint source roots that alias the same real directory", async () => {
    const workspace = await createWorkspace();
    const target = join(workspace, "native");
    const alias = join(workspace, "native-alias");
    await mkdir(target, { recursive: true });
    try {
      await symlink(target, alias, "junction");
    } catch {
      return;
    }

    await expect(
      compileCatalog({
        cwd: workspace,
        config: {
          sources: [
            { root: "native", inputSchema: "scg-v1" },
            { root: "native-alias", inputSchema: "zdp-v2" }
          ]
        }
      })
    ).rejects.toMatchObject({
      name: "SourceConfigError",
      diagnostic: { code: "config.invalid", field: "sources" }
    });
  });

  it("rejects a source root that cannot be resolved before discovery", async () => {
    const workspace = await createWorkspace();

    await expect(
      compileCatalog({
        cwd: workspace,
        config: { sources: [{ root: "missing", inputSchema: "scg-v1" }] }
      })
    ).rejects.toMatchObject({
      name: "SourceConfigError",
      diagnostic: { code: "config.invalid", field: "sources.0.root" }
    });
  });

  it("applies manifest and service-count budgets once across all sources", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/billing/service.yaml", nativeService("billing-api"));
    await writeManifest(workspace, "zdp/runtime/service.yaml", zdpService("platform-runtime"));

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        ...sourceConfig(),
        limits: { maxManifests: 1 },
        validation: { minimumServiceCount: 1 }
      }
    });

    expect(result.discoveredManifests).toHaveLength(1);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "config.invalid")
    ).toHaveLength(1);
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-source-adapters-"));
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

function sourceConfig(): CatalogConfigInput {
  return {
    sources: [
      { root: "native", inputSchema: "scg-v1" },
      { root: "zdp", inputSchema: "zdp-v2" }
    ],
    validation: { minimumServiceCount: 2 }
  };
}

function nativeService(id: string, target?: string): string {
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
    ...(target
      ? [
          "  - type: service",
          `    target: ${target}`,
          "    direction: outbound",
          "    criticality: required"
        ]
      : ["  []"]),
    "metadata:",
    '  lastReviewedAt: "2026-07-01"'
  ].join("\n");
}

function zdpService(id: string): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    '  last_reviewed_at: "2026-07-01"',
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
