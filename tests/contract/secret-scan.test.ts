import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const cleanupRoots: string[] = [];
const scannerPath = join(process.cwd(), "scripts", "secret-scan.mjs");

afterEach(() => {
  for (const root of cleanupRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("secret-scan contract", () => {
  it("passes clean files without requiring git state", () => {
    const workspace = createWorkspace();
    const file = join(workspace, "clean.md");
    writeFileSync(file, "This document mentions NODE_AUTH_TOKEN without containing a value.\n");

    const output = execFileSync(process.execPath, ["scripts/secret-scan.mjs", file], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    expect(output).toContain("secret-scan: ok");
  });

  it("fails on high-confidence token values without echoing the value", () => {
    const workspace = createWorkspace();
    const file = join(workspace, "leak.txt");
    const token = `ghp_${"123456789012345678901234567890123456"}`;
    writeFileSync(file, `token=${token}\n`);

    expect(() =>
      execFileSync(process.execPath, ["scripts/secret-scan.mjs", file], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      })
    ).toThrowError(/secret-like values detected/);

    try {
      execFileSync(process.execPath, ["scripts/secret-scan.mjs", file], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? "");
      expect(stderr).toContain("github-token");
      expect(stderr).not.toContain(token);
    }
  });

  it("scans untracked non-ignored files", () => {
    const workspace = createGitWorkspace();
    const token = `ghp_${"123456789012345678901234567890123456"}`;
    writeFileSync(join(workspace, "untracked.txt"), `token=${token}\n`);

    expect(() => runRepositoryScan(workspace)).toThrowError(/secret-like values detected/);
  });

  it("skips tracked files deleted from the working tree", () => {
    const workspace = createGitWorkspace();
    const deleted = join(workspace, "deleted.txt");
    writeFileSync(deleted, "safe\n");
    execFileSync("git", ["add", "deleted.txt"], { cwd: workspace, stdio: "ignore" });
    unlinkSync(deleted);

    expect(runRepositoryScan(workspace)).toContain("secret-scan: ok");
  });
});

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "scg-secret-scan-"));
  cleanupRoots.push(root);
  return root;
}

function createGitWorkspace(): string {
  const root = createWorkspace();
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
  writeFileSync(join(root, ".gitignore"), "ignored.txt\n");
  writeFileSync(join(root, "tracked.txt"), "safe\n");
  execFileSync("git", ["add", ".gitignore", "tracked.txt"], { cwd: root, stdio: "ignore" });
  return root;
}

function runRepositoryScan(workspace: string): string {
  return execFileSync(process.execPath, [scannerPath], {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
