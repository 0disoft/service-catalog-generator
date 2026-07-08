import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  buildCliArguments,
  getInput,
  runAction,
  splitListInput
} from "../../packages/action/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("GitHub Action wrapper", () => {
  it("keeps action metadata aligned with the public action contract", async () => {
    const metadata = parse(await readFile(join(process.cwd(), "action.yml"), "utf8")) as {
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
      runs: {
        using: string;
        main: string;
      };
    };

    expect(metadata.runs).toEqual({
      using: "node24",
      main: "dist/action/index.cjs"
    });
    expect(Object.keys(metadata.inputs).sort()).toEqual([
      "allow-unknown-dependencies",
      "config",
      "fail-on-warning",
      "format",
      "input-schema",
      "manifest-name",
      "output-directory",
      "report",
      "roots"
    ]);
    expect(Object.keys(metadata.outputs).sort()).toEqual([
      "error-count",
      "report-directory",
      "service-count",
      "warning-count"
    ]);
  });

  it("keeps the committed action entrypoint covered by a read-only self-smoke workflow", async () => {
    const workflow = parse(
      await readFile(join(process.cwd(), ".github/workflows/action-self-smoke.yml"), "utf8")
    ) as {
      name: string;
      permissions: {
        contents: string;
      };
      jobs: {
        "self-smoke": {
          steps: Array<{
            id?: string;
            uses?: string;
            with?: Record<string, string>;
          }>;
        };
      };
    };

    const steps = workflow.jobs["self-smoke"].steps;
    const actionStep = steps.find((step) => step.id === "scg");

    expect(workflow.name).toBe("action-self-smoke");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(steps.some((step) => step.uses === "actions/checkout@v7")).toBe(true);
    expect(actionStep).toEqual(
      expect.objectContaining({
        uses: "./",
        with: {
          roots: ".tmp/action-smoke/services",
          report: "true",
          format: "json,dot,html",
          "output-directory": ".tmp/action-smoke/.catalog"
        }
      })
    );
  });

  it("maps action inputs to check CLI arguments", () => {
    const argv = buildCliArguments(
      {
        INPUT_ROOTS: "services, libs",
        INPUT_MANIFEST_NAME: "catalog.yaml",
        INPUT_CONFIG: "scg.config.yaml",
        INPUT_FAIL_ON_WARNING: "true",
        INPUT_ALLOW_UNKNOWN_DEPENDENCIES: "true"
      },
      "check"
    );

    expect(argv).toEqual([
      "check",
      "--json",
      "--root",
      "services",
      "--root",
      "libs",
      "--manifest",
      "catalog.yaml",
      "--input-schema",
      "scg-v1",
      "--config",
      "scg.config.yaml",
      "--fail-on-warning",
      "--allow-unknown-dependencies"
    ]);
  });

  it("maps report inputs to report CLI arguments", () => {
    const argv = buildCliArguments(
      {
        INPUT_REPORT: "true",
        INPUT_OUTPUT_DIRECTORY: "out/catalog",
        INPUT_FORMAT: "json\nhtml"
      },
      "report"
    );

    expect(argv).toEqual([
      "report",
      "--json",
      "--root",
      ".",
      "--manifest",
      "service.yaml",
      "--input-schema",
      "scg-v1",
      "--out",
      "out/catalog",
      "--format",
      "json",
      "--format",
      "html"
    ]);
  });

  it("maps explicit input schema values to CLI arguments", () => {
    const argv = buildCliArguments(
      {
        INPUT_INPUT_SCHEMA: "zdp-v2"
      },
      "check"
    );

    expect(argv).toContain("--input-schema");
    expect(argv).toContain("zdp-v2");
  });

  it("supports GitHub's hyphenated input environment names", () => {
    expect(getInput({ "INPUT_MANIFEST-NAME": "service.yaml" }, "manifest-name")).toBe(
      "service.yaml"
    );
    expect(splitListInput("services\nlibs, apps")).toEqual(["services", "libs", "apps"]);
  });

  it("runs check mode, propagates CLI status, and writes summary outputs", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_ROOTS: "services"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(0);
    expect(outputs.get("service-count")).toBe("1");
    expect(outputs.get("error-count")).toBe("0");
    expect(outputs.get("warning-count")).toBe("0");
    expect(outputs.get("report-directory")).toBe("");
  });

  it("runs report mode and exposes the report directory output", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_REPORT: "true",
        INPUT_ROOTS: "services",
        INPUT_FORMAT: "json",
        INPUT_OUTPUT_DIRECTORY: ".catalog"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(0);
    expect(outputs.get("service-count")).toBe("1");
    expect(outputs.get("report-directory")).toBe(".catalog");
  });

  it("propagates validation failures from the CLI", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/billing/service.yaml",
      serviceYaml(
        "billing-api",
        [
          "dependencies:",
          "  - type: service",
          "    target: ghost-api",
          "    direction: outbound",
          "    criticality: required"
        ].join("\n")
      )
    );
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_ROOTS: "services"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(1);
    expect(outputs.get("error-count")).toBe("1");
  });

  it("does not emit fabricated zero outputs when the CLI produces no JSON summary", async () => {
    const workspace = await createWorkspace();
    const outputs = new Map<string, string>();
    const stderrChunks: string[] = [];

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_CONFIG: "missing-scg.config.yaml"
      },
      stdout: {
        write: () => true
      },
      stderr: {
        write: (chunk: string) => {
          stderrChunks.push(chunk);
          return true;
        }
      },
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(2);
    expect(outputs.size).toBe(0);
    expect(stderrChunks.join("")).toContain("Action could not parse scg JSON summary");
  });
});

function createIo(): {
  stdout: { write: (chunk: string) => boolean };
  stderr: { write: (chunk: string) => boolean };
} {
  return {
    stdout: {
      write: () => true
    },
    stderr: {
      write: () => true
    }
  };
}

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-action-"));
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

function serviceYaml(id: string, dependencyBlock = "dependencies:\n  []"): string {
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
    dependencyBlock,
    "metadata:",
    '  lastReviewedAt: "2026-07-01"'
  ].join("\n");
}
