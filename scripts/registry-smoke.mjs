import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { observeNpmVersion } from "./npm-release-visibility.mjs";
import { resolveNpmCommand, runInstalledCli } from "./package-smoke-helpers.mjs";
import { normalizeReleaseVersion } from "./release-version.mjs";
import { runConsumerConformance } from "./consumer-conformance.mjs";

const root = process.cwd();
const packageName = "@0disoft/service-catalog-generator";
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const version = normalizeReleaseVersion(
  args[0] ?? process.env.RELEASE_VERSION ?? rootPackage.version
);
const npmCommand = resolveNpmCommand();
const workspace = await mkdtemp(join(tmpdir(), "scg-registry-smoke-"));

try {
  const registryState = await observeNpmVersion({
    packageName,
    version,
    attempts: 12,
    delayMs: 5_000
  });
  assert(registryState === "published", `npm registry state is ${registryState}`);

  await writeFile(join(workspace, "package.json"), '{"private":true}\n', "utf8");
  execFileSync(
    npmCommand.file,
    [
      ...npmCommand.prefixArgs,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `${packageName}@${version}`
    ],
    {
      cwd: workspace,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const binPath = join(
    workspace,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "scg.cmd" : "scg"
  );
  assert(existsSync(binPath), "published package must install the scg binary shim");
  assert(runInstalledCli(binPath, workspace, ["--version"]) === version, "CLI version mismatch");
  const completion = runInstalledCli(binPath, workspace, ["completion", "powershell"]);
  assert(
    completion.includes("Register-ArgumentCompleter -Native -CommandName scg"),
    "published CLI must generate PowerShell completion"
  );

  await cp(join(root, "examples"), join(workspace, "examples"), { recursive: true });
  await runConsumerConformance({
    root: workspace,
    manifestPath: join(workspace, "examples", "consumer-conformance.json"),
    expectedToolVersion: version,
    verifyReports: true,
    invokeCli: ({ cwd, args }) => runInstalledCli(binPath, cwd, args)
  });

  console.log(
    `registry-smoke: ok ${packageName}@${version} (${process.platform}, native=2/1/0, legacy=1/0/0, mixed=2/1/0)`
  );
} finally {
  await rm(workspace, { force: true, recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`registry-smoke: ${message}`);
  }
}
