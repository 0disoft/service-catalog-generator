import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export function resolveNpmCommand() {
  const nodeDir = dirname(process.execPath);
  const npmCliCandidates = [
    resolve(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ];
  const npmCli = npmCliCandidates.find((candidate) => existsSync(candidate));

  return npmCli
    ? { file: process.execPath, prefixArgs: [npmCli] }
    : { file: "npm", prefixArgs: [] };
}

export function runInstalledCli(binPath, cwd, args) {
  const invocation = resolveInstalledCliInvocation(binPath);

  return execFileSync(invocation.file, [...invocation.prefixArgs, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

export function resolveInstalledCliInvocation(binPath, platform = process.platform) {
  if (platform !== "win32") {
    return { file: binPath, prefixArgs: [] };
  }

  if (basename(binPath).toLowerCase() !== "scg.cmd" || basename(dirname(binPath)) !== ".bin") {
    throw new Error("Windows package smoke requires the installed node_modules/.bin/scg.cmd shim.");
  }

  const cliEntry = resolve(
    dirname(binPath),
    "..",
    "@0disoft",
    "service-catalog-generator",
    "dist",
    "cli",
    "index.js"
  );
  if (!existsSync(cliEntry)) {
    throw new Error("Installed package CLI entrypoint is missing.");
  }

  return { file: process.execPath, prefixArgs: [cliEntry] };
}
