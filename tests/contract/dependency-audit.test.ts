import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});

describe("dependency-audit validation script", () => {
  it("retries transient pnpm audit failures that do not produce JSON", async () => {
    const workspace = await createWorkspace();
    const counterPath = join(workspace, "attempts.txt");
    await writeFakePnpm(workspace, retryThenPassScript(counterPath));

    const output = execFileSync(process.execPath, ["scripts/dependency-audit.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: testEnv(workspace),
      stdio: ["ignore", "pipe", "pipe"]
    });
    const attempts = await readFile(counterPath, "utf8");

    expect(output).toContain("dependency-audit: ok 249 dependencies");
    expect(attempts.trim()).toBe("2");
  });

  it("fails immediately when pnpm audit reports vulnerabilities as JSON", async () => {
    const workspace = await createWorkspace();
    const counterPath = join(workspace, "attempts.txt");
    await writeFakePnpm(workspace, vulnerabilityScript(counterPath));

    expect(() =>
      execFileSync(process.execPath, ["scripts/dependency-audit.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: testEnv(workspace),
        stdio: ["ignore", "pipe", "pipe"]
      })
    ).toThrow();
    const attempts = await readFile(counterPath, "utf8");

    expect(attempts.trim()).toBe("1");
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scg-dependency-audit-"));
  cleanupRoots.push(root);
  return root;
}

async function writeFakePnpm(workspace: string, script: string): Promise<void> {
  const binDirectory = join(workspace, "bin");
  const cliPath = join(workspace, "node", "node_modules", "pnpm", "bin", "pnpm.mjs");
  const posixPnpmPath = join(binDirectory, "pnpm");
  await mkdir(binDirectory, { recursive: true });
  await mkdir(dirname(cliPath), { recursive: true });
  await writeFile(join(binDirectory, "pnpm.cmd"), "@echo off\r\nexit /b 1\r\n", "utf8");
  await writeFile(cliPath, script, "utf8");
  await writeFile(posixPnpmPath, `#!/usr/bin/env node\n${script}\n`, "utf8");
  await chmod(posixPnpmPath, 0o755);
}

function testEnv(workspace: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${join(workspace, "bin")}${delimiter}${process.env.PATH ?? ""}`,
    SCG_DEPENDENCY_AUDIT_RETRY_DELAY_MS: "0"
  };
}

function retryThenPassScript(counterPath: string): string {
  return fakePnpmScript(
    counterPath,
    [
      "if (attempt === 1) {",
      "  console.error('temporary registry failure');",
      "  process.exit(1);",
      "}",
      "console.log(JSON.stringify({",
      "  advisories: {},",
      "  metadata: {",
      "    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },",
      "    totalDependencies: 249",
      "  }",
      "}));"
    ].join("\n")
  );
}

function vulnerabilityScript(counterPath: string): string {
  return fakePnpmScript(
    counterPath,
    [
      "console.log(JSON.stringify({",
      "  advisories: { one: {} },",
      "  metadata: {",
      "    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 },",
      "    totalDependencies: 249",
      "  }",
      "}));",
      "process.exit(1);"
    ].join("\n")
  );
}

function fakePnpmScript(counterPath: string, body: string): string {
  return [
    "import { existsSync, readFileSync, writeFileSync } from 'node:fs';",
    `const counterPath = ${JSON.stringify(counterPath)};`,
    "const attempt = existsSync(counterPath) ? Number(readFileSync(counterPath, 'utf8')) + 1 : 1;",
    "writeFileSync(counterPath, String(attempt), 'utf8');",
    body
  ].join("\n");
}
