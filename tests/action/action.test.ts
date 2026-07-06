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
      "--out",
      "out/catalog",
      "--format",
      "json",
      "--format",
      "html"
    ]);
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
