import { describe, expect, it } from "vitest";
import {
  cliCommandDefinitions,
  cliFlagDefinitions
} from "../../packages/cli/src/command-metadata.js";
import { runCli } from "../../packages/cli/src/index.js";

describe("shell completion", () => {
  it.each(["bash", "zsh", "powershell"])("renders static %s completion", async (shell) => {
    const io = createIo();
    const exitCode = await runCli({ argv: ["completion", shell], io });
    const output = io.stdoutText();

    expect(exitCode).toBe(0);
    expect(io.stderrText()).toBe("");
    expect(output).toContain("scg");
    for (const command of cliCommandDefinitions) {
      expect(output).toContain(command.name);
    }
    for (const flag of cliFlagDefinitions) {
      expect(output).toContain(flag.name);
    }
    expect(output).toContain("scg-v1");
    expect(output).toContain("zdp-v2");
    expect(output).not.toMatch(/curl|Invoke-WebRequest|Get-ChildItem|\bfind\b|_files/);
  });

  it("rejects missing and unsupported completion shells", async () => {
    for (const args of [[], ["fish"]]) {
      const io = createIo();
      const exitCode = await runCli({ argv: ["completion", ...args], io });

      expect(exitCode).toBe(2);
      expect(io.stderrText()).toContain("Completion shell is missing or unsupported.");
      expect(io.stdoutText()).toBe("");
    }
  });

  it("generates help from the same command and flag metadata", async () => {
    const io = createIo();
    const exitCode = await runCli({ argv: ["--help"], io });
    const output = io.stdoutText();

    expect(exitCode).toBe(0);
    for (const command of cliCommandDefinitions) {
      expect(output).toContain(command.name);
      expect(output).toContain(command.description);
    }
    for (const flag of cliFlagDefinitions) {
      expect(output).toContain(flag.name);
      expect(output).toContain(flag.description);
    }
  });
});

function createIo(): {
  stdout: { write: (chunk: string) => boolean };
  stderr: { write: (chunk: string) => boolean };
  stdoutText: () => string;
  stderrText: () => string;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout: { write: (chunk) => (stdout.push(chunk), true) },
    stderr: { write: (chunk) => (stderr.push(chunk), true) },
    stdoutText: () => stdout.join(""),
    stderrText: () => stderr.join("")
  };
}
