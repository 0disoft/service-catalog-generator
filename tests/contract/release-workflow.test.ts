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
        env?: Record<string, string>;
        run?: string;
        uses?: string;
        with?: Record<string, string | number | boolean>;
      }>;
    };
  };
};

describe("release workflow contract", () => {
  it("publishes through npm trusted publishing", () => {
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
      group: "release-${{ github.repository }}",
      "cancel-in-progress": false
    });
    expect(steps.some((step) => step.uses === "actions/checkout@v7")).toBe(true);
    expect(steps.some((step) => step.uses === "actions/setup-node@v6")).toBe(true);
    expect(steps.some((step) => step.run === "node scripts/release-check.mjs")).toBe(true);
    expect(steps.some((step) => step.run === "pnpm run check")).toBe(true);
    expect(steps.some((step) => step.run === "node scripts/pack-smoke.mjs")).toBe(true);
    expect(
      steps.some(
        (step) =>
          step.name === "Publish npm package" &&
          step.run === "npm publish --access public" &&
          step.env === undefined
      )
    ).toBe(true);
    expect(workflowText).toContain("gh release create");
    expect(workflowText).toContain('git push --force origin "refs/tags/$MAJOR_TAG"');
    expect(workflowText).not.toContain("secrets.NPM_PUBLISH_TOKEN");
    expect(workflowText).not.toMatch(/secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)|NODE_AUTH_TOKEN/i);
  });

  it("keeps scoped package metadata public-release ready", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      name: string;
      version: string;
      license: string;
      files: string[];
      bin: {
        scg: string;
      };
      publishConfig?: {
        access?: string;
      };
      repository: {
        url: string;
      };
    };

    expect(packageJson.name).toBe("@0disoft/service-catalog-generator");
    expect(packageJson.version).toBe("0.5.6");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.bin).toEqual({ scg: "dist/cli/index.js" });
    expect(packageJson.files).toEqual([
      "dist",
      "README.md",
      "CHANGELOG.md",
      "SECURITY.md",
      "LICENSE"
    ]);
    expect(packageJson.repository.url).toBe(
      "git+https://github.com/0disoft/service-catalog-generator.git"
    );
    expect(packageJson.publishConfig).toEqual({ access: "public" });
  });

  it("documents the trusted publisher dry-run command", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const releaseDocs = readFileSync(join(process.cwd(), "docs/ops/release.md"), "utf8");

    expect(packageJson.scripts["release:trust:dry-run"]).toBe(
      "node scripts/trusted-publisher-dry-run.mjs"
    );
    expect(releaseDocs).toContain(
      "npm trust github @0disoft/service-catalog-generator --file release.yml --repository 0disoft/service-catalog-generator --allow-publish"
    );
    expect(releaseDocs).toContain("pnpm run release:trust:dry-run");
  });

  it("keeps package, source, and changelog versions aligned", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    const cliSource = readFileSync(join(process.cwd(), "packages/cli/src/index.ts"), "utf8");
    const coreSource = readFileSync(join(process.cwd(), "packages/core/src/scan.ts"), "utf8");
    const changelog = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");

    expect(cliSource).toContain(`export const cliVersion = "${packageJson.version}"`);
    expect(coreSource).toContain(`const DEFAULT_TOOL_VERSION = "${packageJson.version}"`);
    expect(changelog).toContain(`## ${packageJson.version}`);
  });
});
