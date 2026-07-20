import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type ConformanceCase = {
  id: string;
  cwd: string;
  config: string;
  reportFiles: string[];
  expected: unknown;
};

type ConformanceManifest = {
  schemaVersion: string;
  cases: ConformanceCase[];
};

type WorkflowStep = {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string | number | boolean>;
};

type WorkflowJob = {
  "runs-on": string;
  "timeout-minutes": number;
  strategy?: { "fail-fast": boolean; matrix: { os: string[] } };
  steps: WorkflowStep[];
};

const root = process.cwd();
const kitRoot = join(root, "conformance", "external-consumer");

describe("external consumer conformance kit", () => {
  const kitPackage = readJson(join(kitRoot, "package.json")) as {
    version: string;
    private: boolean;
    type: string;
    engines: { node: string };
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };
  const externalManifest = readJson(join(kitRoot, "conformance.json")) as ConformanceManifest;
  const internalManifest = readJson(
    join(root, "examples", "consumer-conformance.json")
  ) as ConformanceManifest;
  const verifierSource = readFileSync(join(kitRoot, "verify.mjs"), "utf8");

  it("is a private standalone Node project backed only by npm latest", () => {
    expect(kitPackage).toEqual(
      expect.objectContaining({
        version: "0.0.0",
        private: true,
        type: "module",
        engines: { node: ">=24.0.0" },
        scripts: { test: "node verify.mjs cli" },
        dependencies: { "@0disoft/service-catalog-generator": "latest" }
      })
    );

    const imports = [...verifierSource.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((specifier) => specifier?.startsWith("node:"))).toBe(true);
    expect(verifierSource).not.toContain("scripts/");
    expect(verifierSource).not.toContain("packages/");
    expect(verifierSource).not.toContain("examples/");
  });

  it("keeps the external cases aligned with the stable internal observable results", () => {
    expect(externalManifest.schemaVersion).toBe("scg.consumer-conformance/v1");
    expect(externalManifest.cases.map((contractCase) => contractCase.id)).toEqual([
      "native-scg-v1",
      "legacy-alpha-input",
      "mixed-scg-v1-zdp-v2"
    ]);

    for (const externalCase of externalManifest.cases) {
      const internalCase = internalManifest.cases.find(
        (candidate) => candidate.id === externalCase.id
      );
      expect(internalCase?.expected).toEqual(externalCase.expected);
      expect(externalCase.cwd).toMatch(/^cases\/(native|legacy|mixed)$/);
      expect(externalCase.reportFiles.every((path) => !path.includes(".."))).toBe(true);
      expect(existsSync(join(kitRoot, externalCase.cwd, externalCase.config))).toBe(true);
    }
  });

  it("uses the standalone fixtures for npm latest and exact or moving Action channels", () => {
    const ci = parse(readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8")) as {
      jobs: Record<string, WorkflowJob>;
    };
    const actionSmoke = parse(
      readFileSync(join(root, ".github", "workflows", "released-action-smoke.yml"), "utf8")
    ) as { jobs: Record<string, WorkflowJob> };
    const externalJob = ci.jobs["external-consumer-conformance"];

    expect(externalJob?.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(externalJob?.["runs-on"]).toBe("${{ matrix.os }}");
    expect(externalJob?.["timeout-minutes"]).toBe(10);
    expect(externalJob?.steps.some((step) => step.run?.endsWith(" latest"))).toBe(true);

    const actionSteps = Object.values(actionSmoke.jobs).flatMap((job) => job.steps);
    expect(actionSteps.filter((step) => step.uses?.startsWith("0disoft/")).length).toBe(4);
    expect(
      actionSteps
        .filter((step) => step.uses?.startsWith("0disoft/"))
        .every((step) => String(step.with?.config).startsWith("conformance/external-consumer/"))
    ).toBe(true);
    expect(
      actionSteps
        .filter((step) => step.run?.includes("verify.mjs action"))
        .every((step) => step.run?.startsWith("node conformance/external-consumer/verify.mjs"))
    ).toBe(true);
  });

  it("routes packed and registry installs through the isolated project orchestrator", () => {
    const orchestrator = readFileSync(
      join(root, "scripts", "external-consumer-conformance.mjs"),
      "utf8"
    );
    const registrySmoke = readFileSync(join(root, "scripts", "registry-smoke.mjs"), "utf8");
    const packSmoke = readFileSync(join(root, "scripts", "pack-smoke.mjs"), "utf8");

    expect(orchestrator).toContain('join(repositoryRoot, "conformance", "external-consumer")');
    expect(orchestrator).not.toContain('join(root, "examples")');
    expect(orchestrator).not.toContain("runConsumerConformance");
    expect(registrySmoke).toContain("runExternalConsumerConformance");
    expect(packSmoke).toContain("runExternalConsumerConformance");
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
