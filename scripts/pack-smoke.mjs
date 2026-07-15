import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveNpmCommand, runInstalledCli } from "./package-smoke-helpers.mjs";

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

  await cp(join(root, "examples", "native-consumer"), installDirectory, { recursive: true });

  runInstalledCli(binPath, installDirectory, [
    "report",
    "--config",
    "scg.config.yaml",
    "--no-color"
  ]);
  assert(
    existsSync(join(installDirectory, ".catalog", "catalog.json")),
    "report smoke missing catalog.json"
  );
  const catalog = JSON.parse(await readFile(join(installDirectory, ".catalog", "catalog.json")));
  assert(catalog.summary.serviceCount === 2, "native consumer must compile two services");
  assert(catalog.summary.edgeCount === 1, "native consumer must resolve one dependency edge");

  await cp(
    join(root, "examples", "mixed-consumer"),
    join(installDirectory, "examples", "mixed-consumer"),
    {
      recursive: true
    }
  );
  runInstalledCli(binPath, installDirectory, [
    "report",
    "--config",
    "examples/mixed-consumer/scg.config.yaml",
    "--no-color"
  ]);
  const mixedCatalog = JSON.parse(
    await readFile(join(installDirectory, ".catalog-mixed", "catalog.json"))
  );
  assert(mixedCatalog.summary.serviceCount === 2, "mixed consumer must compile two services");
  assert(mixedCatalog.summary.errorCount === 0, "mixed consumer must compile without errors");
  assert(mixedCatalog.summary.edgeCount === 1, "mixed consumer must resolve a cross-source edge");
  assert(
    mixedCatalog.services.map((service) => service.id).join(",") === "billing-api,platform-runtime",
    "mixed consumer must preserve native and ZDP services"
  );

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
