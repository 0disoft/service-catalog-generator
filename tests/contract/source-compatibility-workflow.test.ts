import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("source compatibility workflow contract", () => {
  it("runs source ownership tests on Ubuntu and Windows", () => {
    const workflow = parse(
      readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8")
    ) as {
      jobs: Record<
        string,
        {
          name?: string;
          "runs-on": string;
          "timeout-minutes": number;
          strategy?: { "fail-fast": boolean; matrix: { os: string[] } };
          steps: Array<{ run?: string }>;
        }
      >;
    };
    const job = workflow.jobs["source-compatibility"];

    expect(job?.name).toBe("source compatibility (${{ matrix.os }})");
    expect(job?.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(job?.["runs-on"]).toBe("${{ matrix.os }}");
    expect(job?.["timeout-minutes"]).toBe(10);
    const commands = job?.steps
      .map((step) => step.run)
      .filter((run): run is string => Boolean(run));
    const focusedTestCommand =
      "pnpm exec vitest run tests/core/source-scoped-adapters.test.ts tests/core/source-scoped-compatibility.test.ts";

    expect(commands).toContain("pnpm run build");
    expect(commands).toContain(focusedTestCommand);
    expect(commands?.indexOf("pnpm run build")).toBeLessThan(commands?.indexOf(focusedTestCommand));
  });
});
