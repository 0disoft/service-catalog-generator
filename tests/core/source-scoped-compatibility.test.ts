import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("source-scoped adapter filesystem compatibility", () => {
  it("uses each source's manifest names without cross-matching sibling files", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/billing/catalog.yaml", nativeService("billing-api"));
    await writeManifest(workspace, "native/ignored/service.yaml", nativeService("ignored-native"));
    await writeManifest(workspace, "zdp/runtime/zdp-service.yml", zdpService("platform-runtime"));
    await writeManifest(workspace, "zdp/ignored/service.yaml", zdpService("ignored-zdp"));

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        sources: [
          { root: "native", inputSchema: "scg-v1", manifestNames: ["catalog.yaml"] },
          { root: "zdp", inputSchema: "zdp-v2", manifestNames: ["zdp-service.yml"] }
        ],
        validation: { minimumServiceCount: 2 }
      }
    });

    expect(result.snapshot.summary).toMatchObject({ serviceCount: 2, errorCount: 0 });
    expect(result.services.map((service) => service.id)).toEqual([
      "billing-api",
      "platform-runtime"
    ]);
  });

  it("applies global excludes relative to every source root", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/current/service.yaml", nativeService("native-current"));
    await writeManifest(workspace, "native/archive/service.yaml", nativeService("native-archive"));
    await writeManifest(workspace, "zdp/current/service.yaml", zdpService("zdp-current"));
    await writeManifest(workspace, "zdp/archive/service.yaml", zdpService("zdp-archive"));

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        sources: [
          { root: "native", inputSchema: "scg-v1" },
          { root: "zdp", inputSchema: "zdp-v2" }
        ],
        scan: { exclude: ["archive/**"] }
      }
    });

    expect(result.services.map((service) => service.id)).toEqual(["native-current", "zdp-current"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects a nested realpath alias even when a lexical sibling sorts between the roots", async () => {
    const workspace = await createWorkspace();
    const parent = join(workspace, "target");
    const child = join(parent, "child");
    const alias = join(workspace, "alias-child");
    await mkdir(child, { recursive: true });
    await mkdir(join(workspace, "target-other"), { recursive: true });
    try {
      await symlink(child, alias, "junction");
    } catch {
      return;
    }

    await expect(
      compileCatalog({
        cwd: workspace,
        config: {
          sources: [
            { root: "target", inputSchema: "scg-v1" },
            { root: "target-other", inputSchema: "scg-v1" },
            { root: "alias-child", inputSchema: "zdp-v2" }
          ]
        }
      })
    ).rejects.toMatchObject({
      name: "SourceConfigError",
      diagnostic: { code: "config.invalid", field: "sources" }
    });
  });

  it("rejects source aliases that resolve outside the workspace", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "workspace");
    const outside = join(parent, "outside");
    const alias = join(workspace, "external-source");
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });
    try {
      await symlink(outside, alias, "junction");
    } catch {
      return;
    }

    await expect(
      compileCatalog({
        cwd: workspace,
        config: { sources: [{ root: "external-source", inputSchema: "scg-v1" }] }
      })
    ).rejects.toMatchObject({
      name: "SourceConfigError",
      diagnostic: { code: "config.invalid", field: "sources.0.root" }
    });
  });

  it("uses filesystem case semantics when resolving source ownership", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "CaseRoot/service.yaml", nativeService("case-native"));

    if (process.platform === "win32") {
      await expect(
        compileCatalog({
          cwd: workspace,
          config: {
            sources: [
              { root: "CaseRoot", inputSchema: "scg-v1" },
              { root: "caseroot", inputSchema: "zdp-v2" }
            ]
          }
        })
      ).rejects.toMatchObject({
        name: "SourceConfigError",
        diagnostic: { code: "config.invalid", field: "sources" }
      });
      return;
    }

    await writeManifest(workspace, "caseroot/service.yaml", zdpService("case-zdp"));
    const result = await compileCatalog({
      cwd: workspace,
      config: {
        sources: [
          { root: "CaseRoot", inputSchema: "scg-v1" },
          { root: "caseroot", inputSchema: "zdp-v2" }
        ]
      }
    });
    expect(result.services.map((service) => service.id)).toEqual(["case-native", "case-zdp"]);
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-source-compatibility-"));
  cleanupRoots.push(root);
  return root;
}

async function writeManifest(workspace: string, path: string, contents: string): Promise<void> {
  const absolutePath = join(workspace, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
}

function nativeService(id: string): string {
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
