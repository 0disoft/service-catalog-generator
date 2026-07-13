import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
  if (process.platform === "win32") {
    return execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "call", binPath, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  }

  return execFileSync(binPath, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
