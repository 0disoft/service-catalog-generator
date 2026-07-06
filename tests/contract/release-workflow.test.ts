import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type ReleaseWorkflow = {
  name: string;
  on: {
    push: {
      tags: string[];
    };
  };
  permissions: Record<string, string>;
  concurrency: {
    group: string;
    "cancel-in-progress": boolean;
  };
  jobs: {
    publish: {
      steps: Array<{
        name?: string;
        run?: string;
        uses?: string;
        with?: Record<string, string | number | boolean>;
      }>;
    };
  };
};

describe("release workflow contract", () => {
  it("publishes through trusted publishing without npm tokens", () => {
    const workflowText = readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8");
    const workflow = parse(workflowText) as ReleaseWorkflow;
    const steps = workflow.jobs.publish.steps;

    expect(workflow.name).toBe("release");
    expect(workflow.on.push.tags).toEqual(["v*.*.*"]);
    expect(workflow.permissions).toEqual({
      contents: "write",
      "id-token": "write"
    });
    expect(workflow.concurrency).toEqual({
      group: "release-${{ github.ref }}",
      "cancel-in-progress": false
    });
    expect(steps.some((step) => step.uses === "actions/checkout@v7")).toBe(true);
    expect(steps.some((step) => step.uses === "actions/setup-node@v6")).toBe(true);
    expect(steps.some((step) => step.run === "node scripts/release-check.mjs")).toBe(true);
    expect(steps.some((step) => step.run === "pnpm run check")).toBe(true);
    expect(steps.some((step) => step.run === "pnpm pack --dry-run")).toBe(true);
    expect(steps.some((step) => step.run === "npm publish --access public")).toBe(true);
    expect(workflowText).toContain("gh release create");
    expect(workflowText).toContain('git push --force origin "refs/tags/$MAJOR_TAG"');
    expect(workflowText).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.NPM/i);
  });

  it("keeps scoped package metadata public-release ready", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      name: string;
      license: string;
      publishConfig?: {
        access?: string;
      };
      repository: {
        url: string;
      };
    };

    expect(packageJson.name).toBe("@0disoft/service-catalog-generator");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.repository.url).toBe(
      "git+https://github.com/0disoft/service-catalog-generator.git"
    );
    expect(packageJson.publishConfig).toEqual({ access: "public" });
  });
});
