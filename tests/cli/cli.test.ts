import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../packages/cli/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("scg CLI", () => {
  it("prints deterministic JSON catalog snapshots for scan", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));

    const io = createIo();
    const exitCode = await runCli({ argv: ["scan", "--json"], cwd: workspace, io });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(snapshot.summary.serviceCount).toBe(1);
    expect(snapshot.services[0].id).toBe("billing-api");
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("sets exit code 1 for catalog validation errors", async () => {
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

    const io = createIo();
    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(1);
    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "dependency.unknown_target",
        file: "services/billing/service.yaml"
      })
    );
  });

  it("promotes warnings when --fail-on-warning is set", async () => {
    const workspace = await createWorkspace();
    await writeManifest(
      workspace,
      "services/stale/service.yaml",
      serviceYaml("stale-api", undefined, "2026-01-01")
    );

    const defaultIo = createIo();
    const defaultExitCode = await runCli({
      argv: ["check", "--json"],
      cwd: workspace,
      io: defaultIo
    });
    const strictIo = createIo();
    const strictExitCode = await runCli({
      argv: ["check", "--json", "--fail-on-warning"],
      cwd: workspace,
      io: strictIo
    });

    expect(defaultExitCode).toBe(0);
    expect(strictExitCode).toBe(1);
  });

  it("applies CLI flag precedence over scg.config.yaml", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1alpha1",
        "scan:",
        "  roots:",
        "    - empty",
        "  manifestNames:",
        "    - catalog.yaml"
      ].join("\n"),
      "utf8"
    );

    const io = createIo();
    const exitCode = await runCli({
      argv: ["scan", "--json", "--root", "services", "--manifest", "service.yaml"],
      cwd: workspace,
      io
    });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(snapshot.summary.serviceCount).toBe(1);
  });

  it("returns exit code 2 for invalid config YAML", async () => {
    const workspace = await createWorkspace();
    await writeFile(join(workspace, "scg.config.yaml"), "schemaVersion: [", "utf8");

    const io = createIo();
    const exitCode = await runCli({ argv: ["scan", "--json"], cwd: workspace, io });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(error.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      file: "scg.config.yaml"
    });
    expect(io.stderrText()).not.toContain("schemaVersion: [");
  });

  it("returns exit code 2 for invalid config values", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      join(workspace, "scg.config.yaml"),
      ["schemaVersion: scg.config/v9"].join("\n"),
      "utf8"
    );

    const io = createIo();
    const exitCode = await runCli({ argv: ["scan", "--json"], cwd: workspace, io });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(error.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      file: "scg.config.yaml"
    });
  });

  it("returns exit code 3 for invalid manifest YAML", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/broken/service.yaml", "schemaVersion: [");

    const io = createIo();
    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(3);
    expect(snapshot.diagnostics[0]).toMatchObject({
      code: "manifest.invalid_yaml",
      file: "services/broken/service.yaml"
    });
  });

  it("keeps report unavailable until report writers exist", async () => {
    const workspace = await createWorkspace();
    const io = createIo();

    const exitCode = await runCli({ argv: ["report", "--json"], cwd: workspace, io });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(error.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      message: "The report command is not implemented yet."
    });
  });
});

function createIo(): {
  stdout: { write: (chunk: string) => boolean };
  stderr: { write: (chunk: string) => boolean };
  stdoutText: () => string;
  stderrText: () => string;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout: {
      write: (chunk: string) => {
        stdout.push(chunk);
        return true;
      }
    },
    stderr: {
      write: (chunk: string) => {
        stderr.push(chunk);
        return true;
      }
    },
    stdoutText: () => stdout.join(""),
    stderrText: () => stderr.join("")
  };
}

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-cli-"));
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

function serviceYaml(
  id: string,
  dependencyBlock = "dependencies:\n  []",
  lastReviewedAt = "2026-07-01"
): string {
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
    `  lastReviewedAt: "${lastReviewedAt}"`
  ].join("\n");
}
