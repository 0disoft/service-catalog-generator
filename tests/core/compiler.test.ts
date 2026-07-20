import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { schemaIssueToDiagnostic } from "../../packages/core/src/diagnostics.js";
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

  it("allows empty catalogs by default and enforces an explicit minimum normalized service count", async () => {
    const workspace = await createWorkspace();

    const defaultResult = await compileCatalog({ cwd: workspace });
    const strictResult = await compileCatalog({
      cwd: workspace,
      config: { validation: { minimumServiceCount: 1 } }
    });

    expect(defaultResult.snapshot.summary).toMatchObject({ serviceCount: 0, errorCount: 0 });
    expect(strictResult.snapshot.summary).toMatchObject({ serviceCount: 0, errorCount: 1 });
    expect(strictResult.snapshot.diagnostics).toContainEqual({
      severity: "error",
      code: "catalog.minimum_service_count",
      field: "validation.minimumServiceCount",
      message: "Catalog contains 0 normalized services, below the configured minimum of 1.",
      hint: "Add valid service manifests, expand scan roots, or lower validation.minimumServiceCount."
    });
  });

  it("evaluates minimum service count after duplicate ids are excluded", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/one/service.yaml", serviceYaml({ id: "shared-api" }));
    await writeManifest(workspace, "services/two/service.yaml", serviceYaml({ id: "shared-api" }));

    const result = await compileCatalog({
      cwd: workspace,
      config: { validation: { minimumServiceCount: 1 } }
    });

    expect(result.snapshot.summary).toMatchObject({ serviceCount: 0, errorCount: 3 });
    expect(
      result.snapshot.diagnostics.filter(
        (diagnostic) => diagnostic.code === "catalog.minimum_service_count"
      )
    ).toHaveLength(1);
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

  it("fails the complete catalog when aggregate manifest bytes exceed the budget", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/one/service.yaml", serviceYaml({ id: "one-api" }));

    const result = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxTotalManifestBytes: 1 } }
    });

    expect(result.services).toEqual([]);
    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "resource.limit_exceeded",
        message: "Total manifest bytes exceed the configured aggregate limit."
      })
    );
  });

  it("accepts a manifest at the exact byte limit and rejects it one byte below", async () => {
    const workspace = await createWorkspace();
    const manifest = serviceYaml({ id: "bounded-api" });
    const manifestBytes = Buffer.byteLength(manifest);
    await writeManifest(workspace, "services/bounded/service.yaml", manifest);

    const accepted = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxManifestBytes: manifestBytes } }
    });
    expect(accepted.services.map((service) => service.id)).toEqual(["bounded-api"]);

    const rejected = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxManifestBytes: manifestBytes - 1 } }
    });
    expect(rejected.services).toEqual([]);
    expect(rejected.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "manifest.invalid_yaml",
        file: "services/bounded/service.yaml",
        message: "Manifest file exceeds the configured size limit."
      })
    );
  });

  it("fails the complete catalog when aggregate collection entries exceed the budget", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/one/service.yaml", serviceYaml({ id: "one-api" }));

    const result = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxCollectionEntries: 1 } }
    });

    expect(result.services).toEqual([]);
    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "resource.limit_exceeded",
        message: "Manifest collection entries exceed the configured aggregate limit."
      })
    );
  });

  it("rejects manifests whose object depth exceeds the budget", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/one/service.yaml", serviceYaml({ id: "one-api" }));

    const result = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxObjectDepth: 1 } }
    });

    expect(result.services).toEqual([]);
    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "resource.limit_exceeded",
        file: "services/one/service.yaml",
        message: "Manifest object depth exceeds the configured limit."
      })
    );
  });

  it("fails the complete catalog when extensions exceed the aggregate byte budget", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/one/service.yaml",
      `${serviceYaml({ id: "one-api" })}\nextensions:\n  example:\n    note: retained\n`
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: { limits: { maxExtensionBytes: 1 } }
    });

    expect(result.services).toEqual([]);
    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "resource.limit_exceeded",
        message: "Manifest extensions exceed the configured aggregate byte limit."
      })
    );
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

  it("bounds duplicate diagnostics and excludes every conflicting service record", async () => {
    const workspace = await createWorkspace();
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        writeManifest(
          workspace,
          `services/duplicate-${String(index).padStart(2, "0")}/service.yaml`,
          serviceYaml({ id: "duplicate-api" })
        )
      )
    );

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.summary).toMatchObject({ serviceCount: 0, errorCount: 40 });
    expect(result.snapshot.services).toEqual([]);
    expect(result.snapshot.graph.edges).toEqual([]);
    expect(result.snapshot.diagnostics).toHaveLength(40);
    expect(
      result.snapshot.diagnostics.every((diagnostic) => (diagnostic.hint?.length ?? 0) <= 500)
    ).toBe(true);
  });

  it("maps unclassified schema issues to generic invalid manifest diagnostics", () => {
    expect(
      schemaIssueToDiagnostic(
        {
          code: "unknown_schema_issue",
          path: ["metadata", "annotations"],
          message: "Unexpected schema validation failure."
        },
        "services/odd/service.yaml"
      )
    ).toMatchObject({
      severity: "error",
      code: "manifest.invalid",
      file: "services/odd/service.yaml",
      field: "metadata.annotations"
    });
  });

  it("reports duplicate service ids across different manifests", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/one/service.yaml", serviceYaml({ id: "billing-api" }));
    await writeManifest(workspace, "services/two/service.yaml", serviceYaml({ id: "billing-api" }));

    const result = await compileCatalog({ cwd: workspace });

    expect(result.snapshot.summary.serviceCount).toBe(0);
    expect(result.snapshot.summary.errorCount).toBe(2);
    expect(result.snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "manifest.duplicate_id",
          file: "services/one/service.yaml",
          field: "id"
        }),
        expect.objectContaining({
          severity: "error",
          code: "manifest.duplicate_id",
          file: "services/two/service.yaml",
          field: "id"
        })
      ])
    );
  });

  it("maps unsupported schema versions to stable manifest diagnostics", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/bad-version/service.yaml",
      serviceYaml({ id: "bad-version-api" }).replace(
        "schemaVersion: scg.service/v1",
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
        criticality: "required",
        direction: "outbound",
        resolution: "unresolved"
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

  it.each([
    ["missing", (manifest: string) => manifest.replace('  last_reviewed_at: "2026-07-01"\n', "")],
    [
      "malformed",
      (manifest: string) =>
        manifest.replace('  last_reviewed_at: "2026-07-01"', "  last_reviewed_at: yesterday")
    ]
  ])("rejects a %s ZDP v2 review date instead of inventing a sentinel", async (_, mutate) => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "platform/runtime/service.yaml", mutate(zdpV2ServiceYaml()));

    const result = await compileCatalog({ cwd: workspace, inputSchema: "zdp-v2" });

    expect(result.services).toEqual([]);
    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "adapter.invalid_input",
        file: "platform/runtime/service.yaml",
        field: "contract.last_reviewed_at"
      })
    );
    expect(JSON.stringify(result.snapshot)).not.toContain("1970-01-01");
  });

  it("normalizes long repeated owner separators without a backtracking expression", async () => {
    const workspace = await createWorkspace();
    const manifest = zdpV2ServiceYaml().replace(
      "  owner: 0disoft",
      `  owner: "${"-".repeat(100_000)}"`
    );
    await writeManifest(workspace, "platform/runtime/service.yaml", manifest);

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
    expect(result.snapshot.services[0]?.owner.ref).toBe("system:unknown");
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

  it("rejects impossible calendar dates before stale policy checks", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/bad-date/service.yaml",
      serviceYaml({ id: "bad-date-api", lastReviewedAt: "2026-02-31" })
    );

    const result = await compileCatalog({ cwd: workspace, now: date("2026-07-06") });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "manifest.invalid_format",
        file: "services/bad-date/service.yaml",
        field: "metadata.lastReviewedAt"
      })
    );
  });

  it("warns when metadata.lastReviewedAt is in the future", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/future/service.yaml",
      serviceYaml({ id: "future-api", lastReviewedAt: "2026-12-31" })
    );

    const result = await compileCatalog({ cwd: workspace, now: date("2026-07-06") });

    expect(result.snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "metadata.future_review",
        file: "services/future/service.yaml",
        field: "metadata.lastReviewedAt"
      })
    );
  });

  it("redacts repository URLs before JSON, DOT, or HTML report consumers see records", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/private/service.yaml",
      serviceYaml({ id: "private-api", repositoryUrl: "https://git.example.internal/private-api" })
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        privacy: {
          redactRepositoryUrls: true
        }
      }
    });

    expect(result.snapshot.services[0]?.repository).toEqual({
      provider: "unknown",
      slug: "[redacted-repository]"
    });
    expect(JSON.stringify(result.snapshot)).not.toContain("git.example.internal");
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

  it("applies nested exclude globs without dropping sibling manifests", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/current/service.yaml",
      serviceYaml({ id: "current-api" })
    );
    await writeManifest(
      workspace,
      "services/legacy/service.yaml",
      serviceYaml({ id: "legacy-api" })
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        scan: {
          exclude: ["services/legacy/**"]
        }
      }
    });

    expect(result.snapshot.summary.serviceCount).toBe(1);
    expect(result.snapshot.services.map((service) => service.id)).toEqual(["current-api"]);
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("applies recursive exclude globs across nested path segments", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/current/service.yaml",
      serviceYaml({ id: "current-api" })
    );
    await writeManifest(
      workspace,
      "services/team-a/legacy/service.yaml",
      serviceYaml({ id: "team-a-legacy-api" })
    );
    await writeManifest(
      workspace,
      "services/team-b/nested/legacy/service.yaml",
      serviceYaml({ id: "team-b-legacy-api" })
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        scan: {
          exclude: ["services/**/legacy/**"]
        }
      }
    });

    expect(result.snapshot.summary.serviceCount).toBe(1);
    expect(result.snapshot.services.map((service) => service.id)).toEqual(["current-api"]);
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("excludes only the configured output directory when it sits below a scan root", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/billing/service.yaml",
      serviceYaml({ id: "billing-api" })
    );
    await writeManifest(
      workspace,
      "services/.catalog/ghost/service.yaml",
      serviceYaml({ id: "ghost-api" })
    );

    const result = await compileCatalog({
      cwd: workspace,
      config: {
        output: {
          directory: "services/.catalog"
        }
      }
    });

    expect(result.snapshot.summary.serviceCount).toBe(1);
    expect(result.snapshot.services.map((service) => service.id)).toEqual(["billing-api"]);
    expect(result.snapshot.diagnostics).toEqual([]);
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
        criticality: "required",
        direction: "outbound",
        resolution: "catalog"
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
  repositoryUrl?: string;
}): string {
  return [
    "schemaVersion: scg.service/v1",
    `id: ${options.id}`,
    `name: ${options.id}`,
    "lifecycle: production",
    "owner:",
    "  type: team",
    "  ref: team:platform",
    "repository:",
    ...(options.repositoryUrl
      ? ["  provider: url", `  url: ${options.repositoryUrl}`]
      : ["  provider: github", `  slug: example/${options.id}`]),
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
