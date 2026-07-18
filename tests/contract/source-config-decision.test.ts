import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { CatalogConfigSchema } from "../../packages/schema/src/index.js";

const fixtureRoot = join(process.cwd(), "tests/contract/fixtures/source-config");

type DecisionCase = {
  file: string;
  expected: "valid" | "config.invalid";
  reason: string;
};

async function readCases(): Promise<DecisionCase[]> {
  return JSON.parse(await readFile(join(fixtureRoot, "cases.json"), "utf8")) as DecisionCase[];
}

async function readYamlFixture(file: string): Promise<Record<string, unknown>> {
  const source = await readFile(join(fixtureRoot, file), "utf8");
  const document = parseDocument(source, {
    prettyErrors: false,
    schema: "core",
    strict: true,
    uniqueKeys: true,
    merge: false
  });

  expect(document.errors, file).toEqual([]);
  const value = document.toJS({ maxAliasCount: 50 });
  expect(value, file).toBeTypeOf("object");
  expect(Array.isArray(value), file).toBe(false);
  return value as Record<string, unknown>;
}

describe("source-scoped adapter decision fixtures", () => {
  it("keeps the accepted fixture inventory explicit and parseable with the CLI YAML dialect", async () => {
    const cases = await readCases();

    expect(cases).toEqual([
      {
        file: "valid-mixed-sources.yaml",
        expected: "valid",
        reason: "explicit non-overlapping scg-v1 and zdp-v2 sources"
      },
      {
        file: "invalid-empty-sources.yaml",
        expected: "config.invalid",
        reason: "sources must contain at least one entry"
      },
      {
        file: "invalid-legacy-mix.yaml",
        expected: "config.invalid",
        reason: "sources cannot be combined with legacy scan roots"
      },
      {
        file: "invalid-legacy-manifest-names.yaml",
        expected: "config.invalid",
        reason: "sources cannot be combined with legacy manifest names"
      },
      {
        file: "invalid-duplicate-root.yaml",
        expected: "config.invalid",
        reason: "normalized source roots must be unique"
      },
      {
        file: "invalid-overlapping-roots.yaml",
        expected: "config.invalid",
        reason: "ancestor and descendant source roots cannot overlap"
      },
      {
        file: "invalid-unknown-adapter.yaml",
        expected: "config.invalid",
        reason: "input schema adapters must be explicitly supported"
      },
      {
        file: "invalid-empty-manifest-names.yaml",
        expected: "config.invalid",
        reason: "an explicit manifestNames list cannot be empty"
      },
      {
        file: "invalid-empty-manifest-name.yaml",
        expected: "config.invalid",
        reason: "manifest names must be non-empty strings"
      },
      {
        file: "invalid-manifest-path.yaml",
        expected: "config.invalid",
        reason: "manifest names must not contain path separators"
      },
      {
        file: "invalid-absolute-root.yaml",
        expected: "config.invalid",
        reason: "source roots must be workspace-relative"
      },
      {
        file: "invalid-outside-root.yaml",
        expected: "config.invalid",
        reason: "source roots must stay inside the workspace"
      }
    ]);
    expect(new Set(cases.map((testCase) => testCase.file)).size).toBe(cases.length);

    for (const testCase of cases) {
      const value = await readYamlFixture(testCase.file);
      expect(value.schemaVersion, testCase.file).toBe("scg.config/v1");
    }
  });

  it("enforces the accepted static source-scoped config decisions", async () => {
    const cases = await readCases();

    for (const testCase of cases) {
      const value = await readYamlFixture(testCase.file);
      const result = CatalogConfigSchema.safeParse(value);
      expect(result.success, `${testCase.file}: ${testCase.reason}`).toBe(
        testCase.expected === "valid"
      );
    }
  });

  it("detects ancestor overlap when a lexical sibling would interrupt plain string ordering", () => {
    const result = CatalogConfigSchema.safeParse({
      schemaVersion: "scg.config/v1",
      sources: [
        { root: "service", inputSchema: "scg-v1" },
        { root: "service-other", inputSchema: "scg-v1" },
        { root: "service/child", inputSchema: "zdp-v2" }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["sources", 2, "root"],
          message: "Source root overlaps sources.0.root after lexical normalization."
        })
      );
    }
  });

  it("records ownership, aggregation, migration, and implementation staging in the ADR", async () => {
    const adr = await readFile("docs/adr/0013-source-scoped-input-adapters.md", "utf8");

    expect(adr).toContain("Every discovered manifest must belong to exactly one source");
    expect(adr).toContain("realpath resolution");
    expect(adr).toContain("Cross-source dependencies");
    expect(adr).toContain("Legacy mode remains supported");
    expect(adr).toContain("Status: Implemented");
  });
});
