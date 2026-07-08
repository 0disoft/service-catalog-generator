import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

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

  const manifestDirectory = join(installDirectory, "services", "billing");
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(
    join(manifestDirectory, "service.yaml"),
    [
      "schemaVersion: scg.service/v1alpha1",
      "id: billing-api",
      "name: Billing API",
      "lifecycle: production",
      "owner:",
      "  type: team",
      "  ref: team:platform",
      "repository:",
      "  provider: github",
      "  slug: example/billing-api",
      "runtime:",
      "  language: typescript",
      "  platform: node",
      "deploy:",
      "  type: container",
      "  targets:",
      "    - environment: production",
      "      provider: unknown",
      "      ref: billing-api-prod",
      "data:",
      "  storesPersonalData: false",
      "  classification: internal",
      "dependencies: []",
      "metadata:",
      '  lastReviewedAt: "2026-07-01"',
      ""
    ].join("\n"),
    "utf8"
  );

  runInstalledCli(binPath, installDirectory, [
    "report",
    "--root",
    "services",
    "--out",
    ".catalog",
    "--format",
    "json",
    "--no-color"
  ]);
  assert(
    existsSync(join(installDirectory, ".catalog", "catalog.json")),
    "report smoke missing catalog.json"
  );

  console.log(`pack-smoke: ok ${packageJson.name}@${packageJson.version}`);
} finally {
  await rm(packDirectory, { force: true, recursive: true });
  await rm(installDirectory, { force: true, recursive: true });
}

function runInstalledCli(binPath, cwd, args) {
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

function resolveNpmCommand() {
  const nodeDir = dirname(process.execPath);
  const npmCliCandidates = [
    resolve(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ];
  const npmCli = npmCliCandidates.find((candidate) => existsSync(candidate));

  if (npmCli) {
    return {
      file: process.execPath,
      prefixArgs: [npmCli]
    };
  }

  return {
    file: "npm",
    prefixArgs: []
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`pack-smoke: ${message}`);
    process.exit(1);
  }
}
