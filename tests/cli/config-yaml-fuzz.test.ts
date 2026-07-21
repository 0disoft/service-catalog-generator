import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../packages/cli/src/index.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("config YAML property fuzzing", () => {
  it("classifies parser and alias-conversion failures as invalid YAML", async () => {
    const cases = [
      "schemaVersion: scg.config/v1\nschemaVersion: scg.config/v1alpha1",
      "schemaVersion:\n\tvalue: scg.config/v1",
      "value: [",
      aliasExpansionYaml()
    ];

    for (const source of cases) {
      const result = await runConfig(source);
      expect(result.exitCode).toBe(2);
      expect(result.output.diagnostics).toContainEqual(
        expect.objectContaining({ code: "config.invalid", message: "Config YAML is invalid." })
      );
      expect(JSON.stringify(result.output)).not.toContain(source);
    }
  });

  it("rejects malformed UTF-8 config bytes explicitly", async () => {
    const result = await runConfig(
      Buffer.concat([
        Buffer.from("schemaVersion: scg.config/v1\noutput:\n  directory: "),
        Buffer.from([0xc3])
      ])
    );

    expect(result.exitCode).toBe(2);
    expect(result.output.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "config.invalid",
        message: "Config file is not valid UTF-8."
      })
    );
  });

  it("handles deterministic seeded config mutations without uncaught failures", async () => {
    const workspace = await createWorkspace();
    const baseline = [
      "schemaVersion: scg.config/v1",
      "scan:",
      "  roots:",
      "    - .",
      "  manifestNames:",
      "    - service.yaml"
    ].join("\n");

    for (const source of seededMutations(baseline, 32)) {
      const first = await runConfig(source, workspace);
      const second = await runConfig(source, workspace);
      expect(second).toEqual(first);
      expect([0, 2]).toContain(first.exitCode);
      expect(JSON.stringify(first.output).length).toBeLessThan(16 * 1024);
    }
  });
});

async function runConfig(
  contents: string | Buffer,
  workspace?: string
): Promise<{
  exitCode: number;
  output: { diagnostics?: Array<{ code: string; message: string }> };
}> {
  const activeWorkspace = workspace ?? (await createWorkspace());
  await writeFile(join(activeWorkspace, "scg.config.yaml"), contents);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli({
    argv: ["scan", "--json"],
    cwd: activeWorkspace,
    io: {
      stdout: { write: (value) => (stdout.push(String(value)), true) },
      stderr: { write: (value) => (stderr.push(String(value)), true) }
    }
  });
  return {
    exitCode,
    output: JSON.parse((exitCode === 0 ? stdout : stderr).join(""))
  };
}

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "scg-config-fuzz-"));
  cleanupRoots.push(workspace);
  return workspace;
}

function* seededMutations(source: string, count: number): Generator<string> {
  const tokens = ["[", "]", "{", "}", "&x", "*x", "\0", "\t", "#", ":"];
  let state = 0xc0ff_ee11;
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 22_695_477) + 1) >>> 0;
    const offset = state % (source.length + 1);
    const token = tokens[(state >>> 12) % tokens.length] ?? "[";
    yield `${source.slice(0, offset)}${token}${source.slice(offset)}`;
  }
}

function aliasExpansionYaml(): string {
  const aliases = Array.from({ length: 10 }, () => "*base").join(", ");
  return [
    "schemaVersion: scg.config/v1",
    "base: &base [one, two, three, four, five, six, seven, eight]",
    `expanded: &expanded [${aliases}]`,
    `output: { directory: [${Array.from({ length: 10 }, () => "*expanded").join(", ")}] }`
  ].join("\n");
}
