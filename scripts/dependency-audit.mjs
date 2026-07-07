import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

let output;
const pnpmCommand = resolvePnpmCommand();

try {
  output = execFileSync(pnpmCommand.file, [...pnpmCommand.prefixArgs, "audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
} catch (error) {
  output = getProcessOutput(error);
  const audit = parseAudit(output);
  if (!audit) {
    console.error("dependency-audit: pnpm audit failed before producing JSON output");
    process.exit(1);
  }

  printFailures(audit);
  process.exit(1);
}

const audit = parseAudit(output);
if (!audit) {
  console.error("dependency-audit: pnpm audit did not produce JSON output");
  process.exit(1);
}

const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
const total = numberOrZero(vulnerabilities.total);
if (total > 0) {
  printFailures(audit);
  process.exit(1);
}

console.log(`dependency-audit: ok ${numberOrZero(audit.metadata?.totalDependencies)} dependencies`);

function parseAudit(output) {
  try {
    return JSON.parse(output);
  } catch {
    return undefined;
  }
}

function printFailures(audit) {
  const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
  console.error(
    [
      "dependency-audit: vulnerabilities detected",
      `critical=${numberOrZero(vulnerabilities.critical)}`,
      `high=${numberOrZero(vulnerabilities.high)}`,
      `moderate=${numberOrZero(vulnerabilities.moderate)}`,
      `low=${numberOrZero(vulnerabilities.low)}`,
      `info=${numberOrZero(vulnerabilities.info)}`
    ].join(" ")
  );
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getProcessOutput(error) {
  if (typeof error !== "object" || error === null || !("stdout" in error)) {
    return "";
  }

  return String(error.stdout ?? "");
}

function resolvePnpmCommand() {
  if (process.platform === "win32") {
    const pnpmShim = findWindowsCommand("pnpm");
    const pnpmCli = pnpmShim ? findPnpmCliFromShim(pnpmShim) : undefined;
    if (pnpmCli) {
      return {
        file: process.execPath,
        prefixArgs: [pnpmCli]
      };
    }
  }

  return {
    file: "pnpm",
    prefixArgs: []
  };
}

function findWindowsCommand(command) {
  try {
    const output = execFileSync("where.exe", [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => extname(line).toLowerCase() === ".cmd");
  } catch {
    return undefined;
  }
}

function findPnpmCliFromShim(shimPath) {
  const shimDirectory = dirname(shimPath);
  const candidates = [
    resolve(shimDirectory, "..", "node", "node_modules", "pnpm", "bin", "pnpm.mjs"),
    resolve(shimDirectory, "node_modules", "pnpm", "bin", "pnpm.cjs"),
    resolve(shimDirectory, "node_modules", "pnpm", "bin", "pnpm.mjs")
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
