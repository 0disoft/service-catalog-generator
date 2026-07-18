import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveNpmCommand, runInstalledCli } from "./package-smoke-helpers.mjs";
import { runConsumerConformance } from "./consumer-conformance.mjs";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const npmCommand = resolveNpmCommand();
const packDirectory = await mkdtemp(join(tmpdir(), "scg-pack-"));
const installDirectory = await mkdtemp(join(tmpdir(), "scg-pack-install-"));

try {
  const packOutput = execFileSync("pnpm", ["pack", "--pack-destination", packDirectory], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const tarballName = packOutput.split(/\r?\n/).at(-1);
  assert(tarballName, "pnpm pack did not report a tarball");

  const tarballPath = resolve(packDirectory, tarballName);
  assert(existsSync(tarballPath), `packed tarball does not exist: ${tarballPath}`);

  await writeFile(join(installDirectory, "package.json"), '{"private":true}\n', "utf8");
  execFileSync(
    npmCommand.file,
    [
      ...npmCommand.prefixArgs,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarballPath
    ],
    {
      cwd: installDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const binPath = join(
    installDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "scg.cmd" : "scg"
  );
  assert(existsSync(binPath), "installed tarball must expose the scg binary shim");
  const version = runInstalledCli(binPath, installDirectory, ["--version"]);
  assert(version === packageJson.version, `installed CLI version mismatch: ${version}`);
  const completion = runInstalledCli(binPath, installDirectory, ["completion", "powershell"]);
  assert(
    completion.includes("Register-ArgumentCompleter -Native -CommandName scg"),
    "installed CLI must generate PowerShell completion"
  );

  await cp(join(root, "examples"), join(installDirectory, "examples"), { recursive: true });
  await runConsumerConformance({
    root: installDirectory,
    manifestPath: join(installDirectory, "examples", "consumer-conformance.json"),
    expectedToolVersion: packageJson.version,
    verifyReports: true,
    invokeCli: ({ cwd, args }) => runInstalledCli(binPath, cwd, args)
  });

  console.log(`pack-smoke: ok ${packageJson.name}@${packageJson.version}`);
} finally {
  await rm(packDirectory, { force: true, recursive: true });
  await rm(installDirectory, { force: true, recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`pack-smoke: ${message}`);
    process.exit(1);
  }
}
