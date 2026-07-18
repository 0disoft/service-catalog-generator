import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  appendGitHubOutput,
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
  it("writes multiline outputs without allowing injected output assignments", async () => {
    const workspace = await createWorkspace();
    const outputFile = join(workspace, "github-output.txt");

    appendGitHubOutput(outputFile, "report-directory", ".catalog\nservice-count=999");

    const contents = await readFile(outputFile, "utf8");
    const lines = contents.trimEnd().split(/\r?\n/);
    const delimiter = lines[0]?.split("<<")[1];
    expect(lines).toEqual([
      `report-directory<<${delimiter}`,
      ".catalog",
      "service-count=999",
      delimiter
    ]);
    expect(contents).not.toContain("report-directory=.catalog");
  });

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
    for (const name of [
      "roots",
      "manifest-name",
      "input-schema",
      "output-directory",
      "fail-on-warning",
      "allow-unknown-dependencies",
      "format"
    ]) {
      expect(metadata.inputs[name]).not.toHaveProperty("default");
    }
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
            name?: string;
            uses?: string;
            "continue-on-error"?: boolean;
            with?: Record<string, string>;
            run?: string;
          }>;
        };
      };
    };

    const steps = workflow.jobs["self-smoke"].steps;
    const actionStep = steps.find((step) => step.id === "scg");
    const mixedActionStep = steps.find((step) => step.id === "scg_mixed");
    const zdpActionStep = steps.find((step) => step.id === "scg_zdp");
    const zdpWarningStep = steps.find((step) => step.id === "scg_zdp_warning");

    expect(workflow.name).toBe("action-self-smoke");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(steps).toContainEqual(
      expect.objectContaining({
        uses: "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
        with: {
          "persist-credentials": false
        }
      })
    );
    expect(actionStep).toEqual(
      expect.objectContaining({
        uses: "./",
        with: {
          config: "examples/native-consumer/scg.config.yaml",
          roots: "examples/native-consumer/services",
          report: "true",
          format: "json,dot,html",
          "output-directory": ".tmp/action-smoke/.catalog"
        }
      })
    );
    expect(zdpActionStep).toEqual(
      expect.objectContaining({
        uses: "./",
        with: {
          roots: ".tmp/action-smoke/zdp-valid/client-surfaces/zdp-web-apps",
          "input-schema": "zdp-v2",
          "allow-unknown-dependencies": "true",
          "fail-on-warning": "true"
        }
      })
    );
    expect(mixedActionStep).toEqual(
      expect.objectContaining({
        uses: "./",
        with: {
          config: "examples/mixed-consumer/scg.config.yaml",
          report: "true",
          format: "json",
          "output-directory": ".tmp/action-smoke/mixed"
        }
      })
    );
    expect(steps.find((step) => step.name === "Assert action outputs and reports")?.run).toContain(
      "--action-case native-scg-v1"
    );
    expect(steps.find((step) => step.name === "Assert mixed source action outputs")?.run).toContain(
      "--action-case mixed-scg-v1-zdp-v2"
    );
    expect(zdpWarningStep).toEqual(
      expect.objectContaining({
        uses: "./",
        "continue-on-error": true,
        with: {
          roots: ".tmp/action-smoke/zdp-warning/client-surfaces/zdp-web-apps",
          "input-schema": "zdp-v2",
          "allow-unknown-dependencies": "true",
          "fail-on-warning": "true"
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
      "--summary-json",
      "--root",
      "services",
      "--root",
      "libs",
      "--manifest",
      "catalog.yaml",
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
      "--summary-json",
      "--out",
      "out/catalog",
      "--format",
      "json",
      "--format",
      "html"
    ]);
  });

  it("maps explicit false booleans to config-overriding CLI flags", () => {
    const argv = buildCliArguments(
      {
        INPUT_FAIL_ON_WARNING: "false",
        INPUT_ALLOW_UNKNOWN_DEPENDENCIES: "false"
      },
      "check"
    );

    expect(argv).toEqual([
      "check",
      "--summary-json",
      "--no-fail-on-warning",
      "--no-allow-unknown-dependencies"
    ]);
  });

  it("defers omitted scan inputs to the config file", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "configured/catalog.yaml", serviceYaml("configured-api"));
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1",
        "scan:",
        "  roots:",
        "    - configured",
        "  manifestNames:",
        "    - catalog.yaml"
      ].join("\n"),
      "utf8"
    );
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_CONFIG: "scg.config.yaml"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(0);
    expect(outputs.get("service-count")).toBe("1");
  });

  it("propagates source-scoped selector conflicts as config errors", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1",
        "sources:",
        "  - root: services",
        "    inputSchema: scg-v1"
      ].join("\n"),
      "utf8"
    );
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_CONFIG: "scg.config.yaml",
        INPUT_ROOTS: "services"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(2);
    expect(outputs.size).toBe(0);
    expect(io.stderrText()).toContain("config.invalid");
    expect(io.stderrText()).toContain("--root");
  });

  it("propagates precise config schema diagnostics without fabricating outputs", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1",
        "sources:",
        "  - root: services",
        "    inputSchema: private-adapter"
      ].join("\n"),
      "utf8"
    );
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_CONFIG: "scg.config.yaml"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(2);
    expect(outputs.size).toBe(0);
    expect(io.stderrText()).toContain('"field": "sources.0.inputSchema"');
    expect(io.stderrText()).toContain("Input schema adapter is unsupported.");
    expect(io.stderrText()).not.toContain("private-adapter");
  });

  it("enforces minimum service count policy from the config input", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    await writeFile(
      join(workspace, "scg.config.yaml"),
      ["schemaVersion: scg.config/v1", "validation:", "  minimumServiceCount: 2"].join("\n"),
      "utf8"
    );
    const outputs = new Map<string, string>();
    const io = createIo();

    const exitCode = await runAction({
      cwd: workspace,
      env: {
        GITHUB_WORKSPACE: workspace,
        INPUT_CONFIG: "scg.config.yaml"
      },
      stdout: io.stdout,
      stderr: io.stderr,
      writeOutput: (name, value) => outputs.set(name, value)
    });

    expect(exitCode).toBe(1);
    expect(outputs.get("service-count")).toBe("1");
    expect(outputs.get("error-count")).toBe("1");
    expect(io.stdoutText()).toContain("catalog.minimum_service_count");
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
    expect(io.stdoutText()).not.toContain("billing-api");
    expect(io.stdoutText()).not.toContain('"services"');
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
  stdoutText: () => string;
  stderrText: () => string;
} {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  return {
    stdout: {
      write: (chunk: string) => {
        stdoutChunks.push(chunk);
        return true;
      }
    },
    stderr: {
      write: (chunk: string) => {
        stderrChunks.push(chunk);
        return true;
      }
    },
    stdoutText: () => stdoutChunks.join(""),
    stderrText: () => stderrChunks.join("")
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
    "schemaVersion: scg.service/v1",
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
