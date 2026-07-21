import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const CHECKOUT_ACTION = "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const SETUP_NODE_ACTION = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";

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
        id?: string;
        if?: string;
        name?: string;
        env?: Record<string, string>;
        run?: string;
        uses?: string;
        with?: Record<string, string | number | boolean>;
      }>;
    };
  };
};

type WorkflowSecurityContract = {
  jobs: Record<
    string,
    {
      "timeout-minutes"?: number;
      steps?: Array<{
        uses?: string;
        with?: Record<string, string | number | boolean>;
      }>;
    }
  >;
};

describe("release workflow contract", () => {
  it("publishes through npm trusted publishing", () => {
    const workflowText = readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8");
    const workflow = parse(workflowText) as ReleaseWorkflow;
    const steps = workflow.jobs.publish.steps;
    const moveTagStep = steps.find((step) => step.name === "Move major Action tag");
    const createReleaseStep = steps.find((step) => step.name === "Create GitHub release");
    const npmPreflightStep = steps.find(
      (step) => step.name === "Verify npm version is unpublished"
    );
    const recoveryStep = steps.find(
      (step) => step.name === "Recover GitHub release state when npm publish fails"
    );

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
    expect(steps).toContainEqual(
      expect.objectContaining({
        uses: CHECKOUT_ACTION,
        with: {
          "fetch-depth": 0,
          "persist-credentials": false
        }
      })
    );
    expect(steps.some((step) => step.uses === SETUP_NODE_ACTION)).toBe(true);
    expect(steps.some((step) => step.run === "node scripts/release-check.mjs")).toBe(true);
    expect(steps.some((step) => step.run === "pnpm run check")).toBe(true);
    expect(
      steps.some(
        (step) =>
          step.name === "Verify committed Action bundle" &&
          step.run === "git diff --exit-code -- dist/action/index.cjs"
      )
    ).toBe(true);
    expect(steps.some((step) => step.run === "node scripts/pack-smoke.mjs")).toBe(true);
    expect(
      steps.some(
        (step) =>
          step.name === "Publish npm package" &&
          step.run === 'npm publish --access public --tag "$NPM_DIST_TAG"' &&
          step.env?.NPM_DIST_TAG === "${{ steps.release-preflight.outputs.npm-dist-tag }}"
      )
    ).toBe(true);
    expect(steps.some((step) => step.name === "Capture release recovery state")).toBe(true);
    expect(npmPreflightStep).toEqual(
      expect.objectContaining({
        env: {
          NPM_PACKAGE_NAME: "@0disoft/service-catalog-generator",
          NPM_PACKAGE_VERSION: "${{ steps.release-preflight.outputs.version }}"
        },
        run: "node scripts/npm-release-visibility.mjs expect-absent"
      })
    );
    expect(moveTagStep).toEqual(
      expect.objectContaining({
        id: "major-tag",
        if: "${{ steps.release-preflight.outputs.promote-major-tag == 'true' }}",
        env: {
          GH_TOKEN: "${{ github.token }}",
          MAJOR_TAG: "${{ steps.release-preflight.outputs.major-tag }}",
          TARGET_SHA: "${{ github.sha }}"
        }
      })
    );
    expect(moveTagStep?.run).toContain("node scripts/github-major-tag.mjs promote");
    expect(moveTagStep?.run).toContain('echo "changed=true" >> "$GITHUB_OUTPUT"');
    expect(createReleaseStep).toEqual(
      expect.objectContaining({
        id: "release-create"
      })
    );
    expect(createReleaseStep?.run).toContain('echo "created=true" >> "$GITHUB_OUTPUT"');
    expect(createReleaseStep?.run).toContain("RELEASE_FLAGS+=(--prerelease)");
    expect(createReleaseStep?.run).toContain('"${RELEASE_FLAGS[@]}"');
    const preflightStep = steps.find((step) => step.id === "release-preflight");
    expect(preflightStep?.run).toContain('NPM_DIST_TAG="next"');
    expect(preflightStep?.run).toContain('NPM_DIST_TAG="latest"');
    expect(preflightStep?.run).toContain('PROMOTE_MAJOR_TAG="false"');
    expect(preflightStep?.run).toContain('PROMOTE_MAJOR_TAG="true"');
    expect(recoveryStep).toEqual(
      expect.objectContaining({
        env: {
          GH_TOKEN: "${{ github.token }}",
          MAJOR_TAG: "${{ steps.release-preflight.outputs.major-tag }}",
          PREVIOUS_MAJOR_TARGET: "${{ steps.release-preflight.outputs.previous-major-target }}",
          RELEASE_CREATED: "${{ steps.release-create.outputs.created }}",
          MAJOR_TAG_CHANGED: "${{ steps.major-tag.outputs.changed || 'false' }}",
          NPM_PACKAGE_NAME: "@0disoft/service-catalog-generator",
          NPM_PACKAGE_VERSION: "${{ steps.release-preflight.outputs.version }}"
        }
      })
    );
    expect(recoveryStep?.run).toContain('if [ "$RELEASE_CREATED" = "true" ]; then');
    expect(recoveryStep?.run).toContain("leaving existing release state untouched");
    expect(recoveryStep?.run).toContain('if [ "$MAJOR_TAG_CHANGED" != "true" ]; then');
    expect(recoveryStep?.run).toContain("leaving tag state untouched");
    expect(recoveryStep?.run).toContain("node scripts/npm-release-visibility.mjs state");
    expect(recoveryStep?.run).toContain('if [ "$NPM_RELEASE_STATE" != "absent" ]; then');
    expect(recoveryStep?.run).toContain("preserving GitHub release and tag state");
    expect(recoveryStep?.run).toContain("node scripts/github-major-tag.mjs restore");
    expect(workflowText).toContain("gh release create");
    expect(workflowText).toContain("gh release delete");
    expect(workflowText).toContain("node scripts/github-major-tag.mjs promote");
    expect(workflowText).toContain("node scripts/github-major-tag.mjs restore");
    expect(workflowText).not.toContain("gh api");
    expect(workflowText).not.toMatch(/uses:\s+actions\/(?:checkout|setup-node)@v\d+/);
    expect(workflowText).not.toContain("git push --force");
    expect(workflowText).not.toContain("secrets.NPM_PUBLISH_TOKEN");
    expect(workflowText).not.toMatch(/secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)|NODE_AUTH_TOKEN/i);
  });

  it("keeps npm publish as the last irreversible release step", () => {
    const workflow = parse(
      readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8")
    ) as ReleaseWorkflow;
    const stepNames = workflow.jobs.publish.steps.map((step) => step.name ?? step.run ?? step.uses);

    const releaseIndex = stepNames.indexOf("Create GitHub release");
    const npmPreflightIndex = stepNames.indexOf("Verify npm version is unpublished");
    const tagIndex = stepNames.indexOf("Move major Action tag");
    const publishIndex = stepNames.indexOf("Publish npm package");
    const recoveryIndex = stepNames.indexOf("Recover GitHub release state when npm publish fails");

    expect(releaseIndex).toBeGreaterThan(-1);
    expect(npmPreflightIndex).toBeGreaterThan(-1);
    expect(npmPreflightIndex).toBeLessThan(releaseIndex);
    expect(tagIndex).toBeGreaterThan(releaseIndex);
    expect(publishIndex).toBeGreaterThan(tagIndex);
    expect(recoveryIndex).toBeGreaterThan(publishIndex);
  });

  it("pins third-party workflow Actions and disables checkout credential persistence", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    const releasedActionReference = `0disoft/service-catalog-generator@v${packageJson.version}`;
    const majorActionReference = `0disoft/service-catalog-generator@v${packageJson.version.split(".")[0]}`;
    for (const workflowPath of [
      ".github/workflows/ci.yml",
      ".github/workflows/action-self-smoke.yml",
      ".github/workflows/codeql.yml",
      ".github/workflows/release.yml",
      ".github/workflows/release-smoke.yml",
      ".github/workflows/released-action-smoke.yml"
    ]) {
      const workflowText = readFileSync(join(process.cwd(), workflowPath), "utf8");
      const workflow = parse(workflowText) as WorkflowSecurityContract;
      const actionReferences = [...workflowText.matchAll(/uses:\s*([^\s#]+)/g)].map(
        (match) => match[1]
      );
      const thirdPartyReferences = actionReferences.filter((reference): reference is string =>
        Boolean(reference && !reference.startsWith("./"))
      );

      expect(thirdPartyReferences.length).toBeGreaterThan(0);
      for (const reference of thirdPartyReferences) {
        if (reference === releasedActionReference || reference === majorActionReference) {
          expect(workflowPath).toBe(".github/workflows/released-action-smoke.yml");
        } else {
          expect(reference, workflowPath).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
        }
      }
      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        expect(job["timeout-minutes"], `${workflowPath}:${jobName}`).toBeGreaterThan(0);
        for (const step of job.steps ?? []) {
          if (step.uses === CHECKOUT_ACTION) {
            expect(step.with?.["persist-credentials"], `${workflowPath}:${jobName}`).toBe(false);
          }
        }
      }
    }
  });

  it("checks generated Action bundle drift in CI", () => {
    const workflowText = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(workflowText).toContain("git diff --exit-code -- dist/action/index.cjs");
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
    expect(packageJson.version).toBe("1.0.2");
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

  it("keeps the committed Action bundle aligned with the release version", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    const actionBundle = readFileSync(join(process.cwd(), "dist/action/index.cjs"), "utf8");

    const escapedVersion = packageJson.version.replaceAll(".", "\\.");
    expect(actionBundle).toMatch(new RegExp(`var cliVersion\\d* = "${escapedVersion}";`));
  });
});
