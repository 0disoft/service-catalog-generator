import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isCliEntrypoint, runCli } from "../../packages/cli/src/index.js";

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

  it("emits bounded summary JSON without catalog records", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    const io = createIo();

    const exitCode = await runCli({ argv: ["check", "--summary-json"], cwd: workspace, io });
    const result = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(result).toEqual({
      summary: {
        serviceCount: 1,
        errorCount: 0,
        warningCount: 0,
        edgeCount: 0
      },
      diagnostics: []
    });
    expect(result).not.toHaveProperty("services");
    expect(result).not.toHaveProperty("graph");
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

  it("prints deterministic human diagnostics with field locations and hints", async () => {
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
    const exitCode = await runCli({ argv: ["check"], cwd: workspace, io });
    const lines = io.stdoutText().trim().split(/\r?\n/);

    expect(exitCode).toBe(1);
    expect(lines).toEqual([
      "scg check services=1 edges=1 errors=1 warnings=0",
      "error dependency.unknown_target services/billing/service.yaml#dependencies.0.target: Service billing-api depends on unknown service ghost-api.",
      "hint: Add a service.yaml for the target service or allow unknown dependencies in policy."
    ]);
    expect(io.stderrText()).toBe("");
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

  it("supports explicit false CLI overrides for boolean config values", async () => {
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
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1alpha1",
        "validation:",
        "  failOnWarnings: true",
        "  allowUnknownDependencies: true"
      ].join("\n"),
      "utf8"
    );

    const io = createIo();
    const exitCode = await runCli({
      argv: ["check", "--json", "--no-fail-on-warning", "--no-allow-unknown-dependencies"],
      cwd: workspace,
      io
    });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(1);
    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({ code: "dependency.unknown_target" })
    );
  });

  it("compiles ZDP v2 manifests when --input-schema zdp-v2 is selected", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/runtime/service.yaml", zdpV2ServiceYaml());

    const io = createIo();
    const exitCode = await runCli({
      argv: ["scan", "--json", "--input-schema", "zdp-v2"],
      cwd: workspace,
      io
    });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(snapshot.summary.serviceCount).toBe(1);
    expect(snapshot.services[0]).toMatchObject({
      id: "platform-runtime",
      name: "Platform Runtime",
      extensions: {
        zdp: {
          schemaVersion: 2,
          contractVersion: 1
        }
      }
    });
  });

  it("compiles source-scoped adapters without legacy selector flags", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "native/billing/service.yaml", serviceYaml("billing-api"));
    await writeManifest(workspace, "zdp/runtime/service.yaml", zdpV2ServiceYaml());
    await writeSourceConfig(workspace);
    const io = createIo();

    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(snapshot.summary).toMatchObject({ serviceCount: 2, errorCount: 0 });
  });

  it("rejects CLI source selectors when sources are configured", async () => {
    const workspace = await createWorkspace();
    await writeSourceConfig(workspace);

    for (const selector of [
      ["--root", "native"],
      ["--manifest", "service.yaml"],
      ["--input-schema", "scg-v1"]
    ]) {
      const io = createIo();
      const exitCode = await runCli({
        argv: ["check", "--json", ...selector],
        cwd: workspace,
        io
      });
      const payload = JSON.parse(io.stderrText());

      expect(exitCode, selector[0]).toBe(2);
      expect(payload.diagnostics[0], selector[0]).toMatchObject({ code: "config.invalid" });
      expect(payload.diagnostics[0].message, selector[0]).toContain(selector[0]);
    }
  });

  it("returns exit code 2 when a configured source root cannot be resolved", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1alpha1",
        "sources:",
        "  - root: missing",
        "    inputSchema: scg-v1"
      ].join("\n"),
      "utf8"
    );
    const io = createIo();

    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const payload = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(payload.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      field: "sources.0.root"
    });
  });

  it("returns exit code 2 for unsupported input schemas", async () => {
    const workspace = await createWorkspace();
    const io = createIo();

    const exitCode = await runCli({
      argv: ["scan", "--json", "--input-schema", "nope"],
      cwd: workspace,
      io
    });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(error.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      message: "Unsupported input schema. Use scg-v1 or zdp-v2."
    });
  });

  it("returns exit code 2 for removed deterministic flag", async () => {
    const workspace = await createWorkspace();
    const io = createIo();

    const exitCode = await runCli({
      argv: ["scan", "--json", "--deterministic"],
      cwd: workspace,
      io
    });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(error.diagnostics[0]).toMatchObject({
      code: "config.invalid",
      message: "Unknown argument: --deterministic"
    });
  });

  it("does not let environment variables change validation policy", async () => {
    const previousCi = process.env.CI;
    const previousUnknownPolicy = process.env.SCG_ALLOW_UNKNOWN_DEPENDENCIES;
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

    process.env.CI = "true";
    process.env.SCG_ALLOW_UNKNOWN_DEPENDENCIES = "true";

    try {
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
    } finally {
      restoreEnv("CI", previousCi);
      restoreEnv("SCG_ALLOW_UNKNOWN_DEPENDENCIES", previousUnknownPolicy);
    }
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
      file: "scg.config.yaml",
      field: "schemaVersion",
      message: "Config schemaVersion is unsupported.",
      hint: "Use schemaVersion scg.config/v1alpha1."
    });
  });

  it.each([
    {
      name: "unsupported source adapter",
      yaml: [
        "schemaVersion: scg.config/v1alpha1",
        "sources:",
        "  - root: services",
        "    inputSchema: private-adapter"
      ],
      field: "sources.0.inputSchema",
      message: "Input schema adapter is unsupported.",
      hint: "Use scg-v1 or zdp-v2."
    },
    {
      name: "overlapping source roots",
      yaml: [
        "schemaVersion: scg.config/v1alpha1",
        "sources:",
        "  - root: services",
        "    inputSchema: scg-v1",
        "  - root: services/legacy",
        "    inputSchema: zdp-v2"
      ],
      field: "sources.1.root",
      message: "Source root overlaps sources.0.root after lexical normalization.",
      hint: "Use non-overlapping workspace-relative source roots."
    },
    {
      name: "legacy source selector",
      yaml: [
        "schemaVersion: scg.config/v1alpha1",
        "sources:",
        "  - root: services",
        "    inputSchema: scg-v1",
        "scan:",
        "  roots:",
        "    - services"
      ],
      field: "scan.roots",
      message: "scan.roots cannot be combined with sources.",
      hint: "Remove legacy scan selectors when sources is configured."
    },
    {
      name: "empty manifest names",
      yaml: [
        "schemaVersion: scg.config/v1alpha1",
        "sources:",
        "  - root: services",
        "    inputSchema: scg-v1",
        "    manifestNames: []"
      ],
      field: "sources.0.manifestNames",
      message: "manifestNames must contain at least one filename.",
      hint: "Provide at least one non-empty manifest filename or omit manifestNames for service.yaml."
    },
    {
      name: "unknown validation key",
      yaml: ["schemaVersion: scg.config/v1alpha1", "validation:", "  unknownPolicy: true"],
      field: "validation.unknownPolicy",
      message: "Config field validation.unknownPolicy is not supported.",
      hint: "Remove unsupported config fields; the config schema is strict."
    }
  ])("returns a precise config diagnostic for $name", async ({ yaml, field, message, hint }) => {
    const workspace = await createWorkspace();
    await writeFile(join(workspace, "scg.config.yaml"), yaml.join("\n"), "utf8");
    const io = createIo();

    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const payload = JSON.parse(io.stderrText());

    expect(exitCode).toBe(2);
    expect(payload.diagnostics[0]).toEqual({
      severity: "error",
      code: "config.invalid",
      file: "scg.config.yaml",
      field,
      message,
      hint
    });
    expect(io.stderrText()).not.toContain("private-adapter");
  });

  it("enforces the configured minimum normalized service count", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    await writeFile(
      join(workspace, "scg.config.yaml"),
      ["schemaVersion: scg.config/v1alpha1", "validation:", "  minimumServiceCount: 2"].join("\n"),
      "utf8"
    );

    const io = createIo();
    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
    const snapshot = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(1);
    expect(snapshot.summary).toMatchObject({ serviceCount: 1, errorCount: 1 });
    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "catalog.minimum_service_count",
        field: "validation.minimumServiceCount"
      })
    );
  });

  it("rejects a minimum service count above the manifest discovery limit", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      join(workspace, "scg.config.yaml"),
      [
        "schemaVersion: scg.config/v1alpha1",
        "validation:",
        "  minimumServiceCount: 2",
        "limits:",
        "  maxManifests: 1"
      ].join("\n"),
      "utf8"
    );

    const io = createIo();
    const exitCode = await runCli({ argv: ["check", "--json"], cwd: workspace, io });
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

  it("writes report artifacts and emits machine-readable write results", async () => {
    const workspace = await createWorkspace();
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    const io = createIo();

    const exitCode = await runCli({
      argv: ["report", "--json", "--format", "json", "--format", "dot"],
      cwd: workspace,
      io
    });
    const result = JSON.parse(io.stdoutText());

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      schemaVersion: "scg.catalog/v1alpha1",
      services: [expect.objectContaining({ id: "billing-api" })],
      diagnostics: [],
      graph: {
        edges: []
      },
      summary: {
        serviceCount: 1,
        edgeCount: 0,
        errorCount: 0,
        warningCount: 0
      }
    });
    expect(result.files).toEqual([
      {
        format: "json",
        path: ".catalog/catalog.json"
      },
      {
        format: "dot",
        path: ".catalog/graph.dot"
      }
    ]);
    await expect(readFile(join(workspace, ".catalog", "catalog.json"), "utf8")).resolves.toContain(
      '"billing-api"'
    );
    await expect(readFile(join(workspace, ".catalog", "graph.dot"), "utf8")).resolves.toContain(
      "digraph service_catalog"
    );
  });

  it("returns exit code 4 when report output cannot be written safely", async () => {
    const parent = await createWorkspace();
    const workspace = join(parent, "inside");
    await mkdir(workspace, { recursive: true });
    await writeManifest(workspace, "services/billing/service.yaml", serviceYaml("billing-api"));
    const io = createIo();

    const exitCode = await runCli({
      argv: ["report", "--json", "--out", "../outside"],
      cwd: workspace,
      io
    });
    const error = JSON.parse(io.stderrText());

    expect(exitCode).toBe(4);
    expect(error.diagnostics[0]).toMatchObject({
      code: "output.write_failed",
      file: "../outside"
    });
  });

  it("recognizes npm bin symlinks as CLI entrypoints", async () => {
    const workspace = await createWorkspace();
    const cliPath = join(
      workspace,
      "node_modules",
      "@0disoft",
      "service-catalog-generator",
      "dist",
      "cli",
      "index.js"
    );
    const binPath = join(workspace, "node_modules", ".bin", "scg");
    await mkdir(dirname(cliPath), { recursive: true });
    await mkdir(dirname(binPath), { recursive: true });
    await writeFile(cliPath, "#!/usr/bin/env node\n", "utf8");

    try {
      await symlink(cliPath, binPath);
    } catch {
      return;
    }

    expect(isCliEntrypoint(binPath)).toBe(true);
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

async function writeSourceConfig(workspace: string): Promise<void> {
  await writeFile(
    join(workspace, "scg.config.yaml"),
    [
      "schemaVersion: scg.config/v1alpha1",
      "sources:",
      "  - root: native",
      "    inputSchema: scg-v1",
      "  - root: zdp",
      "    inputSchema: zdp-v2",
      "validation:",
      "  minimumServiceCount: 2"
    ].join("\n"),
    "utf8"
  );
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
    "  status: active",
    "runtime:",
    "  core: deployment-contracts",
    "data:",
    "  pii_level: none",
    "dependencies:",
    "  services: []",
    "  datastores: []",
    "  queues: []",
    "  workers: []",
    "  internal_apis: []"
  ].join("\n");
}

function restoreEnv(name: string, previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previousValue;
}
