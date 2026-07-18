import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("TypeScript 7 native compatibility lane", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const workflow = parse(readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8")) as {
    jobs: Record<
      string,
      {
        name?: string;
        strategy?: { "fail-fast": boolean; matrix: { os: string[] } };
        "runs-on": string;
        "timeout-minutes": number;
        steps: Array<{ run?: string }>;
      }
    >;
  };

  it("keeps TypeScript 6 API consumers separate from the TypeScript 7 compiler", () => {
    expect(packageJson.devDependencies.typescript).toBe("6.0.3");
    expect(packageJson.devDependencies["@typescript/native"]).toBe("npm:typescript@7.0.2");
    expect(packageJson.scripts.typecheck).toContain("node_modules/typescript/bin/tsc");
    expect(packageJson.scripts["typecheck:native"]).toContain(
      "node_modules/@typescript/native/bin/tsc"
    );
    expect(packageJson.scripts.build).toContain("node_modules/typescript/bin/tsc");
    expect(packageJson.scripts.check).toContain("pnpm run typecheck:native");
  });

  it("runs the native compiler on Ubuntu and Windows", () => {
    const job = workflow.jobs["typescript-native"];

    expect(job.name).toBe("TypeScript 7 native (${{ matrix.os }})");
    expect(job.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(job["runs-on"]).toBe("${{ matrix.os }}");
    expect(job["timeout-minutes"]).toBe(10);
    expect(job.steps.map((step) => step.run)).toContain("pnpm run typecheck:native");
  });
});
