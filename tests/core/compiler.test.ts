import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileCatalog,
  redactSecretLikeValue,
  stripAnsiAndControl
} from "../../packages/core/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("core catalog compiler", () => {
  it("discovers valid manifests and emits deterministic service records", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/zeta/service.yaml", serviceYaml({ id: "zeta-api" }));
    await writeManifest(workspace, "services/alpha/service.yaml", serviceYaml({ id: "alpha-api" }));

    const result = await compileCatalog({ cwd: workspace, now: date("2026-07-06") });

    expect(result.snapshot.summary.serviceCount).toBe(2);
    expect(result.snapshot.services.map((service) => service.id)).toEqual([
      "alpha-api",
      "zeta-api"
    ]);
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("emits invalid YAML diagnostics without embedding manifest contents", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/broken/service.yaml", "schemaVersion: [");

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.summary.errorCount).toBe(1);
    expect(result.snapshot.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "manifest.invalid_yaml",
      file: "services/broken/service.yaml"
    });
    expect(JSON.stringify(result.snapshot.diagnostics)).not.toContain("schemaVersion: [");
  });

  it("maps missing required fields to stable manifest diagnostics", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/no-owner/service.yaml",
      serviceYaml({ id: "no-owner-api" }).replace(
        ["owner:", "  type: team", "  ref: team:platform", ""].join("\n"),
        ""
      )
    );

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "manifest.missing_required_field",
        file: "services/no-owner/service.yaml",
        field: "owner"
      })
    );
  });

  it("maps unsupported schema versions to stable manifest diagnostics", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/bad-version/service.yaml",
      serviceYaml({ id: "bad-version-api" }).replace(
        "schemaVersion: scg.service/v1alpha1",
        "schemaVersion: scg.service/v9"
      )
    );

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "manifest.invalid_schema_version",
        field: "schemaVersion"
      })
    );
  });

  it("flags unknown service dependency targets by default", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/billing/service.yaml",
      serviceYaml({
        id: "billing-api",
        dependencies: [
          "  - type: service",
          "    target: ghost-api",
          "    direction: outbound",
          "    criticality: required"
        ].join("\n")
      })
    );

    const result = await compileCatalog({ cwd: workspace, now: date("2026-07-06") });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "dependency.unknown_target",
        file: "services/billing/service.yaml",
        field: "dependencies.0.target"
      })
    );
    expect(result.snapshot.graph.edges).toEqual([
      {
        source: "billing-api",
        target: "ghost-api",
        type: "service",
        criticality: "required"
      }
    ]);
  });

  it("allows unknown dependencies only when policy explicitly permits them", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/billing/service.yaml",
      serviceYaml({
        id: "billing-api",
        dependencies: [
          "  - type: service",
          "    target: ghost-api",
          "    direction: outbound",
          "    criticality: required"
        ].join("\n")
      })
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        validation: {
          allowUnknownDependencies: true
        }
      }
    });

    expect(result.snapshot.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "dependency.unknown_target"
    );
  });

  it("normalizes ZDP v2 manifests through the explicit input adapter", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "platform/runtime/service.yaml", zdpV2ServiceYaml());

    const result = await compileCatalog({
      cwd: workspace,
      inputSchema: "zdp-v2",
      config: {
        validation: {
          allowUnknownDependencies: true
        }
      }
    });

    expect(result.snapshot.diagnostics).toEqual([]);
    expect(result.snapshot.services).toHaveLength(1);
    expect(result.snapshot.services[0]).toMatchObject({
      id: "platform-runtime",
      name: "Platform Runtime",
      lifecycle: "experimental",
      owner: {
        type: "system",
        ref: "system:id-0disoft"
      },
      repository: {
        provider: "local",
        slug: "zdp-platform-runtime"
      },
      runtime: {
        language: "unknown",
        platform: "deployment-contracts",
        framework: "docker-coolify-contracts"
      },
      data: {
        storesPersonalData: false,
        classification: "internal"
      },
      dependencies: [
        {
          type: "service",
          target: "platform-infra",
          direction: "outbound",
          criticality: "required"
        },
        {
          type: "database",
          target: "runtime-postgres",
          direction: "outbound",
          criticality: "required"
        }
      ],
      metadata: {
        lastReviewedAt: "2026-07-01"
      },
      extensions: {
        zdp: {
          contractVersion: 1,
          schemaVersion: 2,
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
  });

  it("warns when metadata.lastReviewedAt is stale", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/stale/service.yaml",
      serviceYaml({ id: "stale-api", lastReviewedAt: "2026-01-01" })
    );

    const result = await compileCatalog({ cwd: workspace, now: date("2026-07-06") });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "metadata.stale_review",
        field: "metadata.lastReviewedAt"
      })
    );
  });

  it("maps secret-like manifest values to security diagnostics", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/secret/service.yaml",
      serviceYaml({
        id: "secret-api",
        annotations: "    apiToken: placeholder"
      })
    );

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "security.secret_like_value",
        field: "metadata.annotations.apiToken"
      })
    );
  });

  it("rejects configured scan roots that traverse outside the workspace", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "inside");
    const outside = join(parent, "outside");
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeManifest(outside, "service.yaml", serviceYaml({ id: "outside-api" }));

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        scan: {
          roots: ["../outside"]
        }
      }
    });

    expect(result.snapshot.summary.errorCount).toBe(1);
    expect(result.snapshot.services).toEqual([]);
    expect(result.snapshot.diagnostics[0]).toMatchObject({
      code: "path.outside_scan_root",
      file: "../outside"
    });
  });

  it("skips symlinked directories by default", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "inside");
    const linkedTarget = join(parent, "linked-target");
    const linkPath = join(workspace, "services", "linked");
    await mkdir(workspace, { recursive: true });
    await writeManifest(linkedTarget, "service.yaml", serviceYaml({ id: "linked-api" }));
    await mkdir(join(workspace, "services"), { recursive: true });

    try {
      await symlink(linkedTarget, linkPath, "junction");
    } catch {
      return;
    }

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.services).toEqual([]);
  });

  it("creates graph edges for declared dependencies with stable ordering", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/auth/service.yaml", serviceYaml({ id: "auth-api" }));
    await writeManifest(
      workspace,
      "services/billing/service.yaml",
      serviceYaml({
        id: "billing-api",
        dependencies: [
          "  - type: service",
          "    target: auth-api",
          "    direction: outbound",
          "    criticality: required"
        ].join("\n")
      })
    );

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.graph.edges).toEqual([
      {
        source: "billing-api",
        target: "auth-api",
        type: "service",
        criticality: "required"
      }
    ]);
    expect(result.snapshot.summary.edgeCount).toBe(1);
  });

  it("provides redaction helpers for unsafe display surfaces", () => {
    expect(redactSecretLikeValue("plain catalog text")).toBe("plain catalog text");
    expect(stripAnsiAndControl("\u001b[31mBilling\u001b[0m\u0007")).toBe("Billing");
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-core-"));
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

function serviceYaml(options: {
  id: string;
  dependencies?: string;
  lastReviewedAt?: string;
  annotations?: string;
}): string {
  return [
    "schemaVersion: scg.service/v1alpha1",
    `id: ${options.id}`,
    `name: ${options.id}`,
    "lifecycle: production",
    "owner:",
    "  type: team",
    "  ref: team:platform",
    "repository:",
    "  provider: github",
    `  slug: example/${options.id}`,
    "runtime:",
    "  language: typescript",
    "  platform: node",
    "deploy:",
    "  type: container",
    "  targets:",
    "    - environment: production",
    "      provider: unknown",
    `      ref: ${options.id}-prod`,
    "data:",
    "  storesPersonalData: false",
    "  classification: internal",
    "dependencies:",
    options.dependencies ?? "  []",
    "metadata:",
    `  lastReviewedAt: "${options.lastReviewedAt ?? "2026-07-01"}"`,
    ...(options.annotations ? ["  annotations:", options.annotations] : [])
  ].join("\n");
}

function zdpV2ServiceYaml(): string {
  return [
    "contract:",
    "  schema_version: 2",
    "  contract_version: 1",
    '  last_reviewed_at: "2026-07-01"',
    "service:",
    "  id: platform-runtime",
    "  display_name: Platform Runtime",
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
    "dependencies:",
    "  services:",
    "    - platform-infra",
    "  datastores:",
    "    - runtime-postgres",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
