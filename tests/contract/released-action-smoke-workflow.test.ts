import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const CHECKOUT_ACTION = "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const SETUP_NODE_ACTION = "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e";
const RELEASE_REF =
  "${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}";
const SUCCESSFUL_RELEASE =
  "${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}";
const STABLE_RELEASE_OR_MANUAL =
  "${{ github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && !contains(github.event.workflow_run.head_branch, '-')) }}";

type WorkflowStep = {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
};

type ReleasedActionWorkflow = {
  name: string;
  "run-name": string;
  on: {
    workflow_run: { workflows: string[]; types: string[] };
    workflow_dispatch: null;
  };
  permissions: Record<string, string>;
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: {
    "consumer-smoke": WorkflowJob;
    "major-channel-smoke": WorkflowJob;
  };
};

type WorkflowJob = {
  if: string;
  name: string;
  "runs-on": string;
  "timeout-minutes": number;
  strategy: { "fail-fast": boolean; matrix: { os: string[] } };
  steps: WorkflowStep[];
};

describe("released Action smoke workflow contract", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    version: string;
  };
  const workflow = parse(
    readFileSync(join(process.cwd(), ".github/workflows/released-action-smoke.yml"), "utf8")
  ) as ReleasedActionWorkflow;
  const job = workflow.jobs["consumer-smoke"];
  const majorChannelJob = workflow.jobs["major-channel-smoke"];
  const releaseReference = `0disoft/service-catalog-generator@v${packageJson.version}`;
  const majorReference = `0disoft/service-catalog-generator@v${packageJson.version.split(".")[0]}`;

  it("binds the public Action reference to the package version", () => {
    expect(workflow.name).toBe("released-action-smoke");
    expect(workflow["run-name"]).toBe(`released-action-smoke v${packageJson.version}`);
    expect(workflow.on.workflow_run).toEqual({ workflows: ["release"], types: ["completed"] });
    expect(workflow.on.workflow_dispatch).toBeNull();
    expect(job.if).toBe(SUCCESSFUL_RELEASE);

    const releasedActionSteps = job.steps.filter((step) => step.uses === releaseReference);
    expect(releasedActionSteps.map((step) => step.id)).toEqual(["native", "legacy", "mixed"]);
  });

  it("executes the moving major channel for stable releases and manual replays", () => {
    expect(majorChannelJob.if).toBe(STABLE_RELEASE_OR_MANUAL);

    const majorActionSteps = majorChannelJob.steps.filter((step) => step.uses === majorReference);
    expect(majorActionSteps.map((step) => step.id)).toEqual(["major"]);
    expect(
      majorChannelJob.steps.some(
        (step) =>
          step.run ===
          "node scripts/consumer-conformance.mjs --action-case native-scg-v1 --catalog .tmp/released-action/major/catalog.json"
      )
    ).toBe(true);
  });

  it("runs all maintained consumers on Ubuntu and Windows with read-only permissions", () => {
    expect(workflow.permissions).toEqual({ actions: "read", contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "released-action-smoke-${{ github.event.workflow_run.id || github.run_id }}",
      "cancel-in-progress": false
    });
    expect(job["runs-on"]).toBe("${{ matrix.os }}");
    expect(job["timeout-minutes"]).toBe(10);
    expect(job.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(job.steps).toContainEqual(
      expect.objectContaining({
        uses: CHECKOUT_ACTION,
        with: { ref: RELEASE_REF, "persist-credentials": false }
      })
    );
    expect(job.steps).toContainEqual(
      expect.objectContaining({
        uses: SETUP_NODE_ACTION,
        with: { "node-version": 24, "package-manager-cache": false }
      })
    );

    for (const caseId of ["native-scg-v1", "legacy-alpha-input", "mixed-scg-v1-zdp-v2"]) {
      expect(job.steps.some((step) => step.run?.includes(`--action-case ${caseId}`))).toBe(true);
    }

    expect(majorChannelJob["runs-on"]).toBe("${{ matrix.os }}");
    expect(majorChannelJob["timeout-minutes"]).toBe(10);
    expect(majorChannelJob.strategy).toEqual({
      "fail-fast": false,
      matrix: { os: ["ubuntu-latest", "windows-latest"] }
    });
    expect(majorChannelJob.steps).toContainEqual(
      expect.objectContaining({
        uses: CHECKOUT_ACTION,
        with: { ref: RELEASE_REF, "persist-credentials": false }
      })
    );
    expect(majorChannelJob.steps).toContainEqual(
      expect.objectContaining({
        uses: SETUP_NODE_ACTION,
        with: { "node-version": 24, "package-manager-cache": false }
      })
    );
  });
});
