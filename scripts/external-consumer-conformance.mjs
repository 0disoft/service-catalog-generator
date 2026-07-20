import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveNpmCommand } from "./package-smoke-helpers.mjs";
import { normalizeReleaseVersion } from "./release-version.mjs";

const packageName = "@0disoft/service-catalog-generator";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kitRoot = join(repositoryRoot, "conformance", "external-consumer");

export async function runExternalConsumerConformance({
  packageSpec = "latest",
  expectedVersion
} = {}) {
  const normalizedSpec = normalizePackageSpec(packageSpec);
  const workspace = await mkdtemp(join(tmpdir(), "scg-external-consumer-"));
  const projectRoot = join(workspace, "consumer");

  try {
    await cp(kitRoot, projectRoot, { recursive: true });
    const packageJsonPath = join(projectRoot, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    packageJson.dependencies = { [packageName]: normalizedSpec };
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const npmCommand = resolveNpmCommand();
    execFileSync(
      npmCommand.file,
      [...npmCommand.prefixArgs, "install", "--ignore-scripts", "--no-audit", "--no-fund"],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    const installedPackage = JSON.parse(
      await readFile(
        join(projectRoot, "node_modules", "@0disoft", "service-catalog-generator", "package.json"),
        "utf8"
      )
    );
    if (expectedVersion !== undefined) {
      assert(
        installedPackage.version === expectedVersion,
        `installed version ${installedPackage.version} does not match ${expectedVersion}`
      );
    }

    const output = execFileSync(
      process.execPath,
      [join(projectRoot, "verify.mjs"), "cli", "--expected-version", installedPackage.version],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();

    return {
      packageSpec: normalizedSpec,
      version: installedPackage.version,
      output
    };
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

function normalizePackageSpec(packageSpec) {
  assert(typeof packageSpec === "string" && packageSpec.length > 0, "package spec is required");
  if (packageSpec === "latest") {
    return packageSpec;
  }

  const resolvedCandidate = resolve(packageSpec);
  if (isAbsolute(packageSpec) || packageSpec.startsWith(".")) {
    return resolvedCandidate;
  }

  return normalizeReleaseVersion(packageSpec);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`external-consumer-conformance: ${message}`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  assert(args.length <= 1, "expected at most one package version, dist-tag, or tarball path");
  const packageSpec = args[0] ?? "latest";
  const expectedVersion =
    packageSpec === "latest" || isAbsolute(packageSpec) || packageSpec.startsWith(".")
      ? undefined
      : normalizeReleaseVersion(packageSpec);
  const result = await runExternalConsumerConformance({ packageSpec, expectedVersion });
  console.log(
    `external-consumer-conformance: ok ${packageName}@${result.version} (${process.platform}, ${result.packageSpec})`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
