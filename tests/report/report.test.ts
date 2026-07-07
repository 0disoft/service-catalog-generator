import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  renderCatalogJson,
  renderGraphDot,
  renderStaticHtml,
  writeCatalogReports
} from "../../packages/report/src/index.js";
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

    expect(dot).toContain('"billing-api" [label="Billing \\"API\\" <prod>"];');
    expect(dot).toContain('"billing-api" -> "auth-api" [label="service/required"];');
    expect(dot).not.toContain('label="Billing "API"');
  });

  it("escapes manifest-derived HTML text", () => {
    const html = renderStaticHtml(snapshot());

    expect(html).toContain("Billing &quot;API&quot; &lt;prod&gt;");
    expect(html).toContain("Fix &lt;owner&gt;");
    expect(html).not.toContain('Billing "API" <prod>');
    expect(html).not.toContain("Fix <owner>");
    expect(html).not.toContain("<script");
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
      version: "0.5.0"
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
          criticality: "required"
        }
      ]
    }
  };
}
