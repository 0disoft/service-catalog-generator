import { writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runConsumerConformance,
  verifyActionConformance
} from "../../scripts/consumer-conformance.mjs";

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true })));
});

describe("consumer conformance kit", () => {
  it("compares observable catalog contracts across independent consumer roots", async () => {
    const workspace = await createWorkspace({ cwd: "consumer" });
    const expected = expectedResult();
    const invokeCli = vi.fn(() => JSON.stringify(snapshot()));
    const reportDirectory = join(workspace, "consumer", ".catalog");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(join(reportDirectory, "catalog.json"), "{}", "utf8");

    await expect(
      runConsumerConformance({
        root: workspace,
        manifestPath: join(workspace, "manifest.json"),
        invokeCli,
        expectedToolVersion: "1.0.1",
        verifyReports: true
      })
    ).resolves.toEqual({
      schemaVersion: "scg.consumer-conformance-result/v1",
      toolVersion: "1.0.1",
      caseCount: 1,
      cases: [{ id: "native", ...expected }]
    });
    expect(invokeCli).toHaveBeenCalledWith({
      cwd: join(workspace, "consumer"),
      args: ["report", "--config", "scg.config.yaml", "--json", "--no-color"]
    });
  });

  it("fails when a consumer changes a stable observable result", async () => {
    const workspace = await createWorkspace({ cwd: "." });
    const changed = snapshot();
    changed.summary.edgeCount = 0;

    await expect(
      runConsumerConformance({
        root: workspace,
        manifestPath: join(workspace, "manifest.json"),
        invokeCli: () => JSON.stringify(changed)
      })
    ).rejects.toThrow("native: conformance mismatch");
  });

  it("rejects consumer working directories outside the declared root", async () => {
    const workspace = await createWorkspace({ cwd: "../outside" });
    const invokeCli = vi.fn();

    await expect(
      runConsumerConformance({
        root: workspace,
        manifestPath: join(workspace, "manifest.json"),
        invokeCli
      })
    ).rejects.toThrow("native: cwd must stay inside the conformance root");
    expect(invokeCli).not.toHaveBeenCalled();
  });

  it("binds GitHub Action outputs to the same catalog contract", async () => {
    const workspace = await createWorkspace({ cwd: "." });
    const catalogPath = join(workspace, "catalog.json");
    await writeFile(catalogPath, JSON.stringify(snapshot()), "utf8");

    await expect(
      verifyActionConformance({
        manifestPath: join(workspace, "manifest.json"),
        caseId: "native",
        catalogPath,
        actionOutputs: { serviceCount: "1", errorCount: "0", warningCount: "0" }
      })
    ).resolves.toEqual({ id: "native", ...expectedResult() });
  });
});

async function createWorkspace(contractCase: { cwd: string }): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "scg-conformance-test-"));
  workspaces.push(workspace);
  await mkdir(join(workspace, "consumer"), { recursive: true });
  await writeFile(
    join(workspace, "manifest.json"),
    JSON.stringify({
      schemaVersion: "scg.consumer-conformance/v1",
      cases: [
        {
          id: "native",
          cwd: contractCase.cwd,
          config: "scg.config.yaml",
          reportFiles: [".catalog/catalog.json"],
          expected: expectedResult()
        }
      ]
    }),
    "utf8"
  );
  return workspace;
}

function expectedResult() {
  return {
    summary: { serviceCount: 1, errorCount: 0, warningCount: 0, edgeCount: 1 },
    serviceIds: ["service-a"],
    diagnosticCodes: [],
    edges: [
      {
        source: "service-a",
        target: "external-a",
        type: "service",
        criticality: "required",
        direction: "outbound",
        resolution: "external"
      }
    ]
  };
}

function snapshot() {
  return {
    schemaVersion: "scg.catalog/v1",
    tool: { name: "service-catalog-generator", version: "1.0.1" },
    summary: { serviceCount: 1, errorCount: 0, warningCount: 0, edgeCount: 1 },
    services: [{ id: "service-a" }],
    diagnostics: [],
    graph: {
      edges: [
        {
          source: "service-a",
          target: "external-a",
          type: "service",
          criticality: "required",
          direction: "outbound",
          resolution: "external"
        }
      ]
    }
  };
}
