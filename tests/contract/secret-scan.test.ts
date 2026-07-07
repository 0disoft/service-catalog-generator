import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const cleanupRoots: string[] = [];

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
});

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "scg-secret-scan-"));
  cleanupRoots.push(root);
  return root;
}
