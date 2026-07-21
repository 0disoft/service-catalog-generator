import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseManifestFile } from "../../packages/core/src/index.js";
import type { DiscoveredManifest } from "../../packages/core/src/types.js";

const cleanupRoots: string[] = [];
const limits = { maxManifestBytes: 256 * 1024, maxObjectDepth: 32 };

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("manifest YAML property fuzzing", () => {
  it("rejects duplicate keys, alias expansion, and over-deep objects with stable diagnostics", async () => {
    const cases = [
      [
        "schemaVersion: scg.service/v1",
        "schemaVersion: scg.service/v1alpha1",
        "id: duplicate-key"
      ].join("\n"),
      aliasExpansionYaml(),
      deepObjectYaml(40)
    ];

    for (const [index, source] of cases.entries()) {
      const file = await writeManifestCase(`adversarial-${index}.yaml`, source);
      const first = await parseManifestFile(file, limits);
      const second = await parseManifestFile(file, limits);

      expect(second).toEqual(first);
      expect(first.ok).toBe(false);
      if (!first.ok) {
        expect(first.diagnostics[0]?.code).toMatch(
          /^(manifest\.invalid_yaml|resource\.limit_exceeded)$/
        );
        expect(JSON.stringify(first.diagnostics)).not.toContain(source);
      }
    }
  });

  it("rejects malformed UTF-8 instead of normalizing replacement characters", async () => {
    const file = await writeManifestCase(
      "invalid-utf8.yaml",
      Buffer.concat([Buffer.from("schemaVersion: scg.service/v1\nname: "), Buffer.from([0xc3])])
    );

    const result = await parseManifestFile(file, limits);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "manifest.invalid_yaml",
          message: "Manifest file is not valid UTF-8."
        })
      );
    }
  });

  it("parses deterministic seeded mutations without throwing or leaking rejected input", async () => {
    const baseline = minimalManifestYaml();
    const reusableFile = await writeManifestCase("mutation.yaml", baseline);
    for (const [index, source] of Array.from(seededMutations(baseline, 48)).entries()) {
      await writeFile(reusableFile.absolutePath, source);
      const file = {
        ...reusableFile,
        relativePath: `mutation-${index}.yaml`,
        sizeBytes: Buffer.byteLength(source)
      };
      const first = await parseManifestFile(file, limits);
      const second = await parseManifestFile(file, limits);

      expect(second).toEqual(first);
      expect(JSON.stringify(first).length).toBeLessThan(64 * 1024);
      if (!first.ok) {
        expect(JSON.stringify(first.diagnostics)).not.toContain(source);
      }
    }
  });
});

async function writeManifestCase(
  name: string,
  contents: string | Buffer
): Promise<DiscoveredManifest> {
  const root = await mkdtemp(join(tmpdir(), "scg-yaml-fuzz-"));
  cleanupRoots.push(root);
  const absolutePath = join(root, name);
  await writeFile(absolutePath, contents);
  const fileStat = await stat(absolutePath);
  return {
    absolutePath,
    realPath: absolutePath,
    relativePath: name,
    rootRealPath: root,
    sizeBytes: fileStat.size,
    inputSchema: "scg-v1"
  };
}

function* seededMutations(source: string, count: number): Generator<string> {
  const tokens = ["[", "]", "{", "}", "&anchor", "*anchor", "\0", "\t", "#", ":"];
  let state = 0x5c6f_1a2b;
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const offset = state % (source.length + 1);
    const token = tokens[(state >>> 16) % tokens.length] ?? "[";
    yield `${source.slice(0, offset)}${token}${source.slice(offset)}`;
  }
}

function aliasExpansionYaml(): string {
  const aliases = Array.from({ length: 10 }, () => "*base").join(", ");
  return [
    "base: &base [one, two, three, four, five, six, seven, eight]",
    `expanded: [${aliases}]`,
    `extensions: { bomb: [${Array.from({ length: 10 }, () => "*expanded").join(", ")}] }`
  ].join("\n");
}

function deepObjectYaml(depth: number): string {
  const lines = ["schemaVersion: scg.service/v1", "extensions:", "  fuzz:"];
  for (let index = 0; index < depth; index += 1) {
    lines.push(`${"  ".repeat(index + 2)}level${index}:`);
  }
  lines.push(`${"  ".repeat(depth + 2)}value: terminal`);
  return lines.join("\n");
}

function minimalManifestYaml(): string {
  return [
    "schemaVersion: scg.service/v1",
    "id: fuzz-service",
    "name: Fuzz Service",
    "lifecycle: production",
    "owner:",
    "  type: team",
    "  ref: team:platform"
  ].join("\n");
}
