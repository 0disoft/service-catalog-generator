import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveInstalledCliInvocation } from "../../scripts/package-smoke-helpers.mjs";

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true })));
});

describe("installed package CLI invocation", () => {
  it("executes the installed JavaScript entrypoint directly on Windows", async () => {
    const workspace = await createInstalledPackage();
    const binPath = join(workspace, "node_modules", ".bin", "scg.cmd");
    const cliEntry = join(
      workspace,
      "node_modules",
      "@0disoft",
      "service-catalog-generator",
      "dist",
      "cli",
      "index.js"
    );

    expect(resolveInstalledCliInvocation(binPath, "win32")).toEqual({
      file: process.execPath,
      prefixArgs: [cliEntry]
    });
  });

  it("keeps direct executable invocation on non-Windows platforms", () => {
    expect(resolveInstalledCliInvocation("/tmp/node_modules/.bin/scg", "linux")).toEqual({
      file: "/tmp/node_modules/.bin/scg",
      prefixArgs: []
    });
  });

  it("rejects an unexpected Windows shim path or missing installed entrypoint", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scg-package-helper-test-"));
    workspaces.push(workspace);

    expect(() => resolveInstalledCliInvocation(join(workspace, "untrusted.cmd"), "win32")).toThrow(
      "node_modules/.bin/scg.cmd"
    );

    const missingEntryShim = join(workspace, "node_modules", ".bin", "scg.cmd");
    await mkdir(join(workspace, "node_modules", ".bin"), { recursive: true });
    await writeFile(missingEntryShim, "@echo off\r\n", "utf8");
    expect(() => resolveInstalledCliInvocation(missingEntryShim, "win32")).toThrow(
      "entrypoint is missing"
    );
  });
});

async function createInstalledPackage(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "scg-package-helper-test-"));
  workspaces.push(workspace);
  const binDirectory = join(workspace, "node_modules", ".bin");
  const cliDirectory = join(
    workspace,
    "node_modules",
    "@0disoft",
    "service-catalog-generator",
    "dist",
    "cli"
  );
  await mkdir(binDirectory, { recursive: true });
  await mkdir(cliDirectory, { recursive: true });
  await writeFile(join(binDirectory, "scg.cmd"), "@echo off\r\n", "utf8");
  await writeFile(join(cliDirectory, "index.js"), "console.log('ok');\n", "utf8");
  return workspace;
}
