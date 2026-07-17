import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  name?: string;
  if?: string;
  shell?: string;
  run?: string;
}

interface ShellCompletionJob {
  name: string;
  strategy: {
    "fail-fast": boolean;
    matrix: {
      include: Array<{ os: string; completion_shell: string }>;
    };
  };
  "runs-on": string;
  "timeout-minutes": number;
  steps: WorkflowStep[];
}

describe("shell completion workflow contract", () => {
  const workflow = parse(readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8")) as {
    jobs: Record<string, ShellCompletionJob>;
  };
  const job = workflow.jobs["shell-completion"];

  it("runs every generated completion in its native hosted shell", () => {
    expect(job.name).toBe("shell completion (${{ matrix.completion_shell }})");
    expect(job.strategy).toEqual({
      "fail-fast": false,
      matrix: {
        include: [
          { os: "ubuntu-24.04", completion_shell: "bash" },
          { os: "macos-15", completion_shell: "zsh" },
          { os: "windows-2025", completion_shell: "powershell" }
        ]
      }
    });
    expect(job["runs-on"]).toBe("${{ matrix.os }}");
    expect(job["timeout-minutes"]).toBe(10);
    expect(job.steps.map((step) => step.run)).toContain("pnpm run build");
  });

  it("parses and registers Bash completion without profiles", () => {
    const step = findStep("Validate Bash completion");

    expect(step.if).toBe("${{ matrix.completion_shell == 'bash' }}");
    expect(step.shell).toBe("bash");
    expect(step.run).toContain("node dist/cli/index.js completion bash");
    expect(step.run).toContain("bash --noprofile --norc -n");
    expect(step.run).toContain('source "$1"');
    expect(step.run).toContain("complete -p scg");
  });

  it("parses and registers Zsh completion without user startup files", () => {
    const step = findStep("Validate Zsh completion");

    expect(step.if).toBe("${{ matrix.completion_shell == 'zsh' }}");
    expect(step.shell).toBe("bash");
    expect(step.run).toContain("node dist/cli/index.js completion zsh");
    expect(step.run).toContain("zsh -dfn");
    expect(step.run).toContain("autoload -Uz compinit");
    expect(step.run).toContain("$+_comps[scg]");
  });

  it("parses, registers, and exercises PowerShell completion without profiles", () => {
    const step = findStep("Validate PowerShell completion");

    expect(step.if).toBe("${{ matrix.completion_shell == 'powershell' }}");
    expect(step.shell).toBe("pwsh");
    expect(step.run).toContain("completion powershell");
    expect(step.run).toContain("Language.Parser]::ParseFile");
    expect(step.run).toContain(". $outputPath");
    expect(step.run).toContain("TabExpansion2");
    expect(step.run).toContain("-notcontains 'check'");
  });

  function findStep(name: string): WorkflowStep {
    const step = job.steps.find((candidate) => candidate.name === name);
    expect(step, `missing workflow step: ${name}`).toBeDefined();
    return step as WorkflowStep;
  }
});
