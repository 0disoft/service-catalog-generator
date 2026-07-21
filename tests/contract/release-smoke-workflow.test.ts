import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const CHECKOUT_ACTION = "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const SETUP_NODE_ACTION = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const RELEASE_VERSION =
  "${{ github.event_name == 'workflow_dispatch' && inputs.version || github.event.workflow_run.head_branch }}";
const RELEASE_REF =
  "${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}";
const SUCCESSFUL_RELEASE =
  "${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}";

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
};

type ReleaseSmokeWorkflow = {
  name: string;
  on: {
    workflow_run: {
      workflows: string[];
      types: string[];
    };
    workflow_dispatch: {
      inputs: {
        version: {
          required: boolean;
          type: string;
        };
      };
    };
  };
  permissions: Record<string, string>;
  concurrency: {
    group: string;
    "cancel-in-progress": boolean;
  };
  jobs: Record<
    string,
    {
      if: string;
      needs?: string;
      "runs-on": string;
      "timeout-minutes": number;
      strategy?: {
        "fail-fast": boolean;
        matrix: {
          os: string[];
        };
      };
      steps: WorkflowStep[];
    }
  >;
};

describe("release smoke workflow contract", () => {
  const workflowText = readFileSync(
    join(process.cwd(), ".github/workflows/release-smoke.yml"),
    "utf8"
  );
  const workflow = parse(workflowText) as ReleaseSmokeWorkflow;
  const registrySmokeText = readFileSync(join(process.cwd(), "scripts/registry-smoke.mjs"), "utf8");

  it("runs after successful releases and supports exact-version replay", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(workflow.name).toBe("release-smoke");
    expect(workflow.on.workflow_run).toEqual({ workflows: ["release"], types: ["completed"] });
    expect(workflow.on.workflow_dispatch.inputs.version).toEqual(
      expect.objectContaining({ required: true, type: "string" })
    );
    expect(workflow.permissions).toEqual({ actions: "read", contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "release-smoke-${{ github.event.workflow_run.id || github.run_id }}",
      "cancel-in-progress": false
    });
    expect(workflow.jobs["registry-smoke"]?.if).toBe(SUCCESSFUL_RELEASE);
    expect(workflow.jobs["release-evidence"]?.if).toBe(SUCCESSFUL_RELEASE);
    expect(packageJson.scripts["registry-smoke"]).toBe("node scripts/registry-smoke.mjs");
  });

  it("installs the exact package on Ubuntu and Windows before evidence verification", () => {
    const registryJob = workflow.jobs["registry-smoke"];
    const evidenceJob = workflow.jobs["release-evidence"];

    expect(registryJob?.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(registryJob?.["runs-on"]).toBe("${{ matrix.os }}");
    expect(evidenceJob?.needs).toBe("registry-smoke");
    expect(evidenceJob?.["runs-on"]).toBe("ubuntu-latest");
    expect(registryJob?.steps).toContainEqual(
      expect.objectContaining({
        name: "Verify exact published package",
        env: { RELEASE_VERSION },
        run: "node scripts/registry-smoke.mjs"
      })
    );
    expect(evidenceJob?.steps).toContainEqual(
      expect.objectContaining({
        name: "Verify release evidence",
        env: { GH_TOKEN: "${{ github.token }}", RELEASE_VERSION },
        run: "node scripts/release-evidence.mjs"
      })
    );
    expect(registrySmokeText).toContain("runExternalConsumerConformance");
    expect(registrySmokeText).not.toContain('join(root, "examples")');
  });

  it("pins Actions, checks out the release commit, and does not persist credentials", () => {
    for (const job of Object.values(workflow.jobs)) {
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      expect(job.steps).toContainEqual(
        expect.objectContaining({
          uses: CHECKOUT_ACTION,
          with: { ref: RELEASE_REF, "persist-credentials": false }
        })
      );
      expect(job.steps.some((step) => step.uses === SETUP_NODE_ACTION)).toBe(true);
    }
  });
});
