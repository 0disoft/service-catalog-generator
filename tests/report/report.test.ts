import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  renderCatalogJson,
  renderGraphDot,
  renderStaticHtml,
  writeCatalogReports
} from "../../packages/report/src/index.js";
import { publishReportGeneration } from "../../packages/report/src/generation-publisher.js";
import type { CatalogSnapshot } from "../../packages/schema/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("report writers", () => {
  it("renders deterministic catalog JSON", () => {
    const json = renderCatalogJson(snapshot());

    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: "scg.catalog/v1alpha1",
      summary: {
        serviceCount: 1,
        edgeCount: 1
      }
    });
    expect(json.endsWith("\n")).toBe(true);
  });

  it("escapes DOT labels and never accepts raw DOT fragments", () => {
    const dot = renderGraphDot(snapshot());

    expect(dot).toContain('"service:billing-api" [label="Billing \\"API\\" <prod>"];');
    expect(dot).toContain(
      '"service:billing-api" -> "service:auth-api" [label="service/required/unresolved"];'
    );
    expect(dot).not.toContain('label="Billing "API"');
  });

  it("keeps typed nodes and dependency directions distinct in DOT", () => {
    const value = snapshot();
    const usersService = structuredClone(value.services[0]);
    usersService.id = "users";
    usersService.name = "Users Service";
    usersService.dependencies = [];
    usersService.source.path = "services/users/service.yaml";
    value.services.push(usersService);
    value.summary.serviceCount = 2;
    value.summary.edgeCount = 2;
    value.graph.edges = [
      {
        source: "billing-api",
        target: "users",
        type: "database",
        criticality: "required",
        direction: "inbound",
        resolution: "external"
      },
      {
        source: "billing-api",
        target: "users",
        type: "service",
        criticality: "required",
        direction: "bidirectional",
        resolution: "catalog"
      }
    ];

    const dot = renderGraphDot(value);

    expect(dot).toContain('"database:users" [label="database:users"];');
    expect(dot).toContain('"service:users" [label="Users Service"];');
    expect(dot).toContain(
      '"database:users" -> "service:billing-api" [label="database/required/external"];'
    );
    expect(dot).toContain(
      '"service:billing-api" -> "service:users" [label="service/required/catalog", dir=both];'
    );
  });

  it("escapes manifest-derived HTML text", () => {
    const html = renderStaticHtml(snapshot());

    expect(html).toContain("Billing &quot;API&quot; &lt;prod&gt;");
    expect(html).toContain("Fix &lt;owner&gt;");
    expect(html).not.toContain('Billing "API" <prod>');
    expect(html).not.toContain("Fix <owner>");
    expect(html).not.toContain("<script");
  });

  it("renders the static report contract without external resources", () => {
    const html = renderStaticHtml(snapshot());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain("<title>Service Catalog</title>");
    expect(html).toContain('<section aria-label="Summary">');
    expect(html).toContain("<h2>Services</h2>");
    expect(html).toContain("<h2>Dependencies</h2>");
    expect(html).toContain("<h2>Diagnostics</h2>");
    expect(html).toContain("<td>services/billing/service.yaml</td>");
    expect(html).toContain("<td>auth-api</td>");
    expect(html).toContain("<td>Update metadata</td>");
    expect(html).not.toMatch(/<(script|iframe|img|link|object|embed)\b/i);
    expect(html).not.toMatch(/\b(?:src|href)=["'](?:https?:)?\/\//i);
  });

  it("writes selected report formats under the output directory", async () => {
    const workspace = await createWorkspace();
    const result = await writeCatalogReports(snapshot(), {
      cwd: workspace,
      outputDirectory: ".catalog",
      formats: ["json", "html"]
    });

    expect(result.files).toEqual([
      {
        format: "json",
        path: ".catalog/catalog.json"
      },
      {
        format: "html",
        path: ".catalog/report.html"
      }
    ]);
    await expect(readFile(join(workspace, ".catalog", "catalog.json"), "utf8")).resolves.toContain(
      '"serviceCount": 1'
    );
    await expect(readFile(join(workspace, ".catalog", "report.html"), "utf8")).resolves.toContain(
      "Service Catalog"
    );
    await expect(
      readFile(join(workspace, ".catalog", ".scg-generation.json"), "utf8")
    ).resolves.toContain('"schemaVersion": "scg.report-generation/v1"');
  });

  it("replaces the complete generation and removes stale report formats", async () => {
    const workspace = await createWorkspace();
    await writeCatalogReports(snapshot(), {
      cwd: workspace,
      outputDirectory: ".catalog",
      formats: []
    });

    await writeCatalogReports(snapshot(), {
      cwd: workspace,
      outputDirectory: ".catalog",
      formats: ["json"]
    });

    await expect(readdir(join(workspace, ".catalog"))).resolves.toEqual([
      ".scg-generation.json",
      "catalog.json"
    ]);
  });

  it("refuses to replace output directories containing unowned files", async () => {
    const workspace = await createWorkspace();
    const outputDirectory = join(workspace, ".catalog");
    await mkdir(outputDirectory);
    await writeFile(join(outputDirectory, "notes.txt"), "keep me\n", "utf8");

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: ".catalog",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        code: "output.write_failed",
        message: "Report output directory contains files that are not owned by SCG."
      })
    });
    await expect(readFile(join(outputDirectory, "notes.txt"), "utf8")).resolves.toBe("keep me\n");
  });

  it("refuses to trust a corrupt generation marker", async () => {
    const workspace = await createWorkspace();
    const outputDirectory = join(workspace, ".catalog");
    await mkdir(outputDirectory);
    await writeFile(join(outputDirectory, "catalog.json"), "old\n", "utf8");
    await writeFile(join(outputDirectory, ".scg-generation.json"), "{}\n", "utf8");

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: ".catalog",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        message: "Report output directory has an invalid generation marker."
      })
    });
    await expect(readFile(join(outputDirectory, "catalog.json"), "utf8")).resolves.toBe("old\n");
  });

  it("rejects the workspace root as a report output directory", async () => {
    const workspace = await createWorkspace();

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: ".",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        message: "The workspace root cannot be used as the report output directory."
      })
    });
  });

  it("excludes a second writer while a generation is staged", async () => {
    const workspace = await createWorkspace();
    const entered = deferred<void>();
    const release = deferred<void>();
    const firstWrite = publishReportGeneration({
      cwdPath: workspace,
      cwdRealPath: workspace,
      outputDirectory: join(workspace, ".catalog"),
      files: [{ name: "catalog.json", contents: "first\n" }],
      hooks: {
        beforePromote: async () => {
          entered.resolve();
          await release.promise;
        }
      }
    });
    await entered.promise;

    await expect(
      publishReportGeneration({
        cwdPath: workspace,
        cwdRealPath: workspace,
        outputDirectory: join(workspace, ".catalog"),
        files: [{ name: "catalog.json", contents: "second\n" }]
      })
    ).rejects.toMatchObject({
      message: "Another report writer owns the output directory lock."
    });

    release.resolve();
    await firstWrite;
    await expect(readFile(join(workspace, ".catalog", "catalog.json"), "utf8")).resolves.toBe(
      "first\n"
    );
  });

  it("restores the previous generation when installation fails after backup", async () => {
    const workspace = await createWorkspace();
    const outputDirectory = join(workspace, ".catalog");
    await publishReportGeneration({
      cwdPath: workspace,
      cwdRealPath: workspace,
      outputDirectory,
      files: [
        { name: "catalog.json", contents: "old json\n" },
        { name: "graph.dot", contents: "old dot\n" }
      ]
    });

    await expect(
      publishReportGeneration({
        cwdPath: workspace,
        cwdRealPath: workspace,
        outputDirectory,
        files: [{ name: "catalog.json", contents: "new json\n" }],
        hooks: {
          beforeInstall: async () => {
            throw new Error("injected promotion failure");
          }
        }
      })
    ).rejects.toThrow("injected promotion failure");

    await expect(readFile(join(outputDirectory, "catalog.json"), "utf8")).resolves.toBe(
      "old json\n"
    );
    await expect(readFile(join(outputDirectory, "graph.dot"), "utf8")).resolves.toBe("old dot\n");
    expect((await readdir(workspace)).filter((entry) => entry.includes(".scg-"))).toEqual([]);
  });

  it("rejects output directories outside the workspace", async () => {
    const workspace = await createWorkspace();

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: "../outside",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        code: "output.write_failed",
        file: "../outside"
      })
    });
  });

  it("rejects control characters in output directory values", async () => {
    const workspace = await createWorkspace();

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: ".catalog\nservice-count=999",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        code: "output.write_failed",
        message: "Output directory contains an invalid control character."
      })
    });
  });

  it.skipIf(process.platform === "win32")(
    "treats backslashes as filename characters on POSIX",
    async () => {
      const parent = await createWorkspace();
      const workspace = join(parent, "workspace");
      await mkdir(workspace, { recursive: true });

      await expect(
        writeCatalogReports(snapshot(), {
          cwd: workspace,
          outputDirectory: "../workspace\\outside",
          formats: ["json"]
        })
      ).rejects.toMatchObject({
        diagnostic: expect.objectContaining({
          code: "output.write_failed"
        })
      });
    }
  );

  it("accepts workspace aliases that resolve to the same directory", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "workspace");
    const workspaceAlias = join(parent, "workspace-alias");
    await mkdir(workspace);

    try {
      await symlink(workspace, workspaceAlias, "junction");
    } catch {
      return;
    }

    await writeCatalogReports(snapshot(), {
      cwd: workspaceAlias,
      outputDirectory: ".catalog",
      formats: ["json"]
    });

    await expect(readFile(join(workspace, ".catalog", "catalog.json"), "utf8")).resolves.toContain(
      '"serviceCount": 1'
    );
  });

  it("rejects symlinked output directories that resolve outside the workspace", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "inside");
    const outside = join(parent, "outside");
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });

    try {
      await symlink(outside, join(workspace, ".catalog"), "junction");
    } catch {
      return;
    }

    await expect(
      writeCatalogReports(snapshot(), {
        cwd: workspace,
        outputDirectory: ".catalog",
        formats: ["json"]
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({
        code: "output.write_failed",
        file: ".catalog"
      })
    });
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-report-"));
  cleanupRoots.push(root);
  return root;
}

function snapshot(): CatalogSnapshot {
  return {
    schemaVersion: "scg.catalog/v1alpha1",
    tool: {
      name: "service-catalog-generator",
      version: "0.5.3"
    },
    summary: {
      serviceCount: 1,
      errorCount: 0,
      warningCount: 1,
      edgeCount: 1
    },
    services: [
      {
        id: "billing-api",
        name: 'Billing "API" <prod>',
        lifecycle: "production",
        owner: {
          type: "team",
          ref: "team:platform"
        },
        repository: {
          provider: "github",
          slug: "example/billing-api"
        },
        runtime: {
          language: "typescript",
          platform: "node"
        },
        deploy: {
          type: "container",
          targets: [
            {
              environment: "production",
              provider: "unknown",
              ref: "billing-api-prod"
            }
          ]
        },
        data: {
          storesPersonalData: false,
          classification: "internal"
        },
        dependencies: [
          {
            type: "service",
            target: "auth-api",
            direction: "outbound",
            criticality: "required"
          }
        ],
        metadata: {
          lastReviewedAt: "2026-07-01"
        },
        source: {
          path: "services/billing/service.yaml"
        }
      }
    ],
    diagnostics: [
      {
        severity: "warning",
        code: "metadata.stale_review",
        file: "services/billing/service.yaml",
        field: "metadata.lastReviewedAt",
        message: "Fix <owner>",
        hint: "Update metadata"
      }
    ],
    graph: {
      edges: [
        {
          source: "billing-api",
          target: "auth-api",
          type: "service",
          criticality: "required",
          direction: "outbound",
          resolution: "unresolved"
        }
      ]
    }
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}
