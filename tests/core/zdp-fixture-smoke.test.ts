import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileCatalog } from "../../packages/core/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("ZDP v2 fixture smoke", () => {
  it("compiles representative ZDP platform service.yaml contracts", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "platform/zdp-platform-runtime/service.yaml", platformRuntime());
    await writeManifest(workspace, "money/zdp-money-platform/service.yaml", moneyPlatform());
    await writeManifest(
      workspace,
      "architecture-tools/zdp-architecture-linter/service.yaml",
      architectureLinter()
    );
    await writeManifest(
      workspace,
      "client-surfaces/zdp-desktop-wails/service.yaml",
      desktopWails()
    );

    const result = await compileCatalog({
      cwd: workspace,
      inputSchema: "zdp-v2",
      config: {
        validation: {
          allowUnknownDependencies: true
        }
      }
    });

    expect(result.snapshot.summary.serviceCount).toBe(4);
    expect(result.snapshot.summary.errorCount).toBe(0);
    expect(result.snapshot.services.map((service) => service.id)).toEqual([
      "architecture-linter",
      "desktop-wails",
      "money-api",
      "platform-runtime"
    ]);

    expect(
      result.snapshot.services.find((service) => service.id === "platform-runtime")
    ).toMatchObject({
      lifecycle: "experimental",
      repository: {
        provider: "local",
        slug: "zdp-platform-runtime"
      },
      data: {
        storesPersonalData: false,
        classification: "internal"
      },
      extensions: {
        zdp: {
          schemaVersion: 2,
          contractVersion: 1,
          tier: "tier2",
          riskLevel: "high",
          domainType: "platform",
          stage: "foundation",
          costCenter: "platform-runtime",
          moneyMovement: false,
          userFacing: false,
          publicApi: false
        }
      }
    });

    expect(result.snapshot.services.find((service) => service.id === "money-api")).toMatchObject({
      data: {
        storesPersonalData: true,
        classification: "confidential"
      },
      extensions: {
        zdp: {
          tier: "tier0",
          riskLevel: "critical",
          domainType: "money",
          moneyMovement: true
        }
      }
    });

    expect(
      result.snapshot.services.find((service) => service.id === "desktop-wails")
    ).toMatchObject({
      data: {
        storesPersonalData: true,
        classification: "restricted"
      },
      extensions: {
        zdp: {
          domainType: "product",
          userFacing: true
        }
      }
    });
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-zdp-fixtures-"));
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

function platformRuntime(): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    "  last_reviewed_at: 2026-07-07",
    "service:",
    "  id: platform-runtime",
    "  owner: 0disoft",
    "  repo: zdp-platform-runtime",
    "  status: experiment",
    "  tier: tier2",
    "  risk_level: high",
    "lifecycle:",
    "  stage: foundation",
    "domain:",
    "  type: platform",
    "  user_facing: false",
    "  public_api: false",
    "  money_movement: false",
    "runtime:",
    "  core: deployment-contracts",
    "  framework: docker-coolify-contracts",
    "cost:",
    "  cost_center: platform-runtime",
    "  owner: 0disoft",
    "data:",
    "  pii_level: none",
    "  payment_data: false",
    "  message_content: false",
    "  ai_user_data: false",
    "  money_movement: false",
    "dependencies:",
    "  services:",
    "    - platform-infra",
    "    - platform-observability",
    "  datastores: []",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}

function moneyPlatform(): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    "  last_reviewed_at: 2026-07-07",
    "service:",
    "  id: money-api",
    "  owner: 0disoft",
    "  repo: zdp-money-platform",
    "  status: experiment",
    "  tier: tier0",
    "  risk_level: critical",
    "lifecycle:",
    "  stage: foundation",
    "domain:",
    "  type: money",
    "  user_facing: false",
    "  public_api: false",
    "  money_movement: true",
    "runtime:",
    "  core: axum",
    "  framework: rust-axum-contracts",
    "cost:",
    "  cost_center: money-platform",
    "  owner: 0disoft",
    "data:",
    "  pii_level: high",
    "  payment_data: true",
    "  message_content: false",
    "  ai_user_data: false",
    "  money_movement: true",
    "dependencies:",
    "  services:",
    "    - zdp-money-platform",
    "    - core-api",
    "    - credential-vault",
    "    - privacy-broker",
    "    - platform-observability",
    "  datastores:",
    "    - billing_postgres",
    "    - payments_postgres",
    "    - ledger_postgres",
    "    - risk_postgres",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}

function architectureLinter(): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    "  last_reviewed_at: 2026-07-07",
    "service:",
    "  id: architecture-linter",
    "  owner: 0disoft",
    "  repo: zdp-architecture-linter",
    "  status: experiment",
    "  tier: tier3",
    "  risk_level: low",
    "lifecycle:",
    "  stage: experiment",
    "domain:",
    "  type: platform",
    "  user_facing: false",
    "  public_api: false",
    "  money_movement: false",
    "runtime:",
    "  core: local-cli",
    "  framework: bun",
    "cost:",
    "  cost_center: architecture-tools",
    "  owner: 0disoft",
    "data:",
    "  pii_level: none",
    "  payment_data: false",
    "  message_content: false",
    "  ai_user_data: false",
    "  money_movement: false",
    "dependencies:",
    "  services: []",
    "  datastores: []",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}

function desktopWails(): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    "  last_reviewed_at: 2026-07-07",
    "service:",
    "  id: desktop-wails",
    "  owner: 0disoft",
    "  repo: zdp-desktop-wails",
    "  status: experiment",
    "  tier: tier2",
    "  risk_level: medium",
    "lifecycle:",
    "  stage: conditional-shell",
    "domain:",
    "  type: product",
    "  user_facing: true",
    "  public_api: false",
    "  money_movement: false",
    "runtime:",
    "  core: wails",
    "  framework: wails-svelte-go-shell-contracts",
    "cost:",
    "  cost_center: desktop-wails",
    "  owner: 0disoft",
    "data:",
    "  pii_level: medium",
    "  payment_data: false",
    "  message_content: false",
    "  ai_user_data: false",
    "  money_movement: false",
    "dependencies:",
    "  services:",
    "    - zdp-core-platform",
    "    - zdp-money-platform",
    "    - zdp-privacy-credential-vault",
    "    - zdp-web-apps",
    "    - zdp-design-system",
    "  datastores: []",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}
