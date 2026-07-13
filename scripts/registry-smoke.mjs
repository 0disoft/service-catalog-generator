import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { observeNpmVersion } from "./npm-release-visibility.mjs";
import { resolveNpmCommand, runInstalledCli } from "./package-smoke-helpers.mjs";
import { normalizeReleaseVersion } from "./release-version.mjs";

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

  await cp(join(root, "examples", "native-consumer"), workspace, { recursive: true });
  runInstalledCli(binPath, workspace, ["report", "--config", "scg.config.yaml", "--no-color"]);

  const catalogPath = join(workspace, ".catalog", "catalog.json");
  assert(existsSync(catalogPath), "registry smoke missing catalog.json");
  assert(existsSync(join(workspace, ".catalog", "graph.dot")), "registry smoke missing graph.dot");
  assert(
    existsSync(join(workspace, ".catalog", "report.html")),
    "registry smoke missing report.html"
  );
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  assert(catalog.summary.serviceCount === 2, "native consumer must compile two services");
  assert(catalog.summary.edgeCount === 1, "native consumer must resolve one dependency edge");
  assert(catalog.summary.errorCount === 0, "native consumer must report zero errors");

  console.log(
    `registry-smoke: ok ${packageName}@${version} (${process.platform}, 2 services, 1 edge, 0 errors)`
  );
} finally {
  await rm(workspace, { force: true, recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`registry-smoke: ${message}`);
  }
}
