import { describe, expect, it } from "vitest";
import { CatalogConfigSchema } from "../../packages/schema/src/index.js";

describe("config path property fuzzing", () => {
  it("accepts generated manifest filenames and preserves their trimmed Unicode spelling", () => {
    for (const name of generatedManifestNames(128)) {
      const result = CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1",
        scan: { manifestNames: [`  ${name}  `] }
      });

      expect(result.success, name).toBe(true);
      if (result.success) {
        expect(result.data.scan.manifestNames).toEqual([name]);
      }
    }
  });

  it("rejects generated path-bearing, dot-segment, and NUL manifest names", () => {
    const invalidNames = [
      ".",
      "..",
      "\0",
      ...generatedManifestNames(64).flatMap((name) => [
        `../${name}`,
        `nested/${name}`,
        `nested\\${name}`,
        `${name}\0.yaml`
      ])
    ];

    for (const name of invalidNames) {
      const result = CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1",
        scan: { manifestNames: [name] }
      });
      expect(result.success, JSON.stringify(name)).toBe(false);
    }
  });

  it("normalizes generated contained source roots and rejects workspace escapes", () => {
    for (const segment of generatedRootSegments(64)) {
      const contained = CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1",
        sources: [{ root: `teams/./${segment}/../${segment}`, inputSchema: "scg-v1" }]
      });
      const escaped = CatalogConfigSchema.safeParse({
        schemaVersion: "scg.config/v1",
        sources: [{ root: `../../${segment}`, inputSchema: "scg-v1" }]
      });

      expect(contained.success, segment).toBe(true);
      if (contained.success) {
        expect(contained.data.sources?.[0]?.root).toBe(`teams/${segment}`);
      }
      expect(escaped.success, segment).toBe(false);
    }
  });
});

function generatedManifestNames(count: number): string[] {
  const alphabet = ["a", "z", "0", "9", "-", "_", ".", "é", "한", "🧭"];
  return generateStrings(count, alphabet).map(
    (value, index) => `${value || "service"}-${index}.yaml`
  );
}

function generatedRootSegments(count: number): string[] {
  return generateStrings(count, ["a", "z", "0", "9", "-", "_", "é", "한"]).map(
    (value, index) => `${value || "team"}-${index}`
  );
}

function generateStrings(count: number, alphabet: string[]): string[] {
  const values: string[] = [];
  let state = 0x1bad_f00d;
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    const length = 1 + (state % 12);
    let value = "";
    for (let offset = 0; offset < length; offset += 1) {
      state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
      value += alphabet[state % alphabet.length] ?? "a";
    }
    values.push(value);
  }
  return values;
}
