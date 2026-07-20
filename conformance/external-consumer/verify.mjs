import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const packageName = "@0disoft/service-catalog-generator";
const manifestSchemaVersion = "scg.consumer-conformance/v1";

async function main() {
  const { mode, options } = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(join(projectRoot, "conformance.json"), "utf8"));
  validateManifest(manifest);

  if (mode === "action") {
    await verifyAction(manifest, options);
    return;
  }

  await verifyCli(manifest, options);
}

async function verifyCli(manifest, options) {
  const installedPackagePath = join(
    projectRoot,
    "node_modules",
    "@0disoft",
    "service-catalog-generator",
    "package.json"
  );
  assert(existsSync(installedPackagePath), `${packageName} is not installed`);

  const installedPackage = JSON.parse(await readFile(installedPackagePath, "utf8"));
  const expectedVersion = options["expected-version"] ?? installedPackage.version;
  assert(
    installedPackage.version === expectedVersion,
    `installed version ${installedPackage.version} does not match ${expectedVersion}`
  );

  const binPath = options.bin
    ? resolve(process.cwd(), options.bin)
    : join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "scg.cmd" : "scg");
  assert(existsSync(binPath), `installed scg binary is missing: ${binPath}`);
  assert(runScg(binPath, projectRoot, ["--version"]) === expectedVersion, "CLI version mismatch");
  assert(
    runScg(binPath, projectRoot, ["completion", "powershell"]).includes(
      "Register-ArgumentCompleter -Native -CommandName scg"
    ),
    "PowerShell completion contract mismatch"
  );

  const results = [];
  for (const contractCase of manifest.cases) {
    const cwd = resolveContainedPath(projectRoot, contractCase.cwd, contractCase.id);
    const output = runScg(binPath, cwd, [
      "report",
      "--config",
      contractCase.config,
      "--json",
      "--no-color"
    ]);
    const snapshot = parseJson(output, `${contractCase.id}: CLI output`);
    assert(
      snapshot?.tool?.version === expectedVersion,
      `${contractCase.id}: tool version ${snapshot?.tool?.version ?? "<missing>"} does not match ${expectedVersion}`
    );
    const actual = selectContractResult(snapshot);
    assertContractResult(contractCase, actual, "CLI");

    for (const reportFile of contractCase.reportFiles) {
      assert(
        existsSync(resolveContainedPath(cwd, reportFile, contractCase.id)),
        `${contractCase.id}: report file is missing: ${reportFile}`
      );
    }
    results.push(contractCase.id);
  }

  console.log(`external-consumer-conformance: cli ok ${expectedVersion} (${results.join(", ")})`);
}

async function verifyAction(manifest, options) {
  const caseId = options.case;
  const catalogCandidate = options.catalog;
  assert(caseId, "action mode requires --case");
  assert(catalogCandidate, "action mode requires --catalog");

  const contractCase = manifest.cases.find((candidate) => candidate.id === caseId);
  assert(contractCase, `unknown action case: ${caseId}`);
  const catalogPath = resolveContainedPath(process.cwd(), catalogCandidate, caseId);
  const snapshot = parseJson(await readFile(catalogPath, "utf8"), `${caseId}: Action catalog`);
  const actual = selectContractResult(snapshot);
  assertContractResult(contractCase, actual, "Action");

  assert(
    String(actual.summary.serviceCount) === process.env.SCG_ACTION_SERVICE_COUNT,
    `${caseId}: action service-count output mismatch`
  );
  assert(
    String(actual.summary.errorCount) === process.env.SCG_ACTION_ERROR_COUNT,
    `${caseId}: action error-count output mismatch`
  );
  assert(
    String(actual.summary.warningCount) === process.env.SCG_ACTION_WARNING_COUNT,
    `${caseId}: action warning-count output mismatch`
  );

  console.log(`external-consumer-conformance: action ok ${caseId}`);
}

function runScg(binPath, cwd, args) {
  const invocation = resolveScgInvocation(binPath);
  return execFileSync(invocation.file, [...invocation.prefixArgs, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function resolveScgInvocation(binPath) {
  if (binPath.endsWith(".js") || binPath.endsWith(".mjs")) {
    return { file: process.execPath, prefixArgs: [binPath] };
  }
  if (process.platform !== "win32") {
    return { file: binPath, prefixArgs: [] };
  }

  assert(
    basename(binPath).toLowerCase() === "scg.cmd" && basename(dirname(binPath)) === ".bin",
    "Windows conformance requires the installed node_modules/.bin/scg.cmd shim"
  );
  const cliEntry = resolve(
    dirname(binPath),
    "..",
    "@0disoft",
    "service-catalog-generator",
    "dist",
    "cli",
    "index.js"
  );
  assert(existsSync(cliEntry), "installed package CLI entrypoint is missing");
  return { file: process.execPath, prefixArgs: [cliEntry] };
}

function selectContractResult(snapshot) {
  assert(snapshot?.schemaVersion === "scg.catalog/v1", "catalog schema version mismatch");
  assert(Array.isArray(snapshot.services), "catalog services are missing");
  assert(Array.isArray(snapshot.diagnostics), "catalog diagnostics are missing");
  assert(Array.isArray(snapshot?.graph?.edges), "catalog graph edges are missing");

  return {
    summary: snapshot.summary,
    serviceIds: snapshot.services.map((service) => service.id),
    diagnosticCodes: snapshot.diagnostics.map((diagnostic) => diagnostic.code),
    edges: snapshot.graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      criticality: edge.criticality,
      direction: edge.direction,
      resolution: edge.resolution
    }))
  };
}

function assertContractResult(contractCase, actual, source) {
  assert(
    isDeepStrictEqual(actual, contractCase.expected),
    `${contractCase.id}: ${source} conformance mismatch\nexpected=${JSON.stringify(contractCase.expected)}\nactual=${JSON.stringify(actual)}`
  );
}

function validateManifest(manifest) {
  assert(
    manifest?.schemaVersion === manifestSchemaVersion,
    `manifest schemaVersion must be ${manifestSchemaVersion}`
  );
  assert(Array.isArray(manifest.cases) && manifest.cases.length > 0, "manifest cases are empty");

  const ids = new Set();
  for (const contractCase of manifest.cases) {
    assert(
      typeof contractCase?.id === "string" && contractCase.id.length > 0,
      "every conformance case needs an id"
    );
    assert(!ids.has(contractCase.id), `duplicate conformance case id: ${contractCase.id}`);
    ids.add(contractCase.id);
    assert(
      typeof contractCase.cwd === "string" && contractCase.cwd.length > 0,
      `${contractCase.id}: cwd is missing`
    );
    assert(
      typeof contractCase.config === "string" && contractCase.config.length > 0,
      `${contractCase.id}: config is missing`
    );
    assert(
      contractCase.expected && typeof contractCase.expected === "object",
      `${contractCase.id}: expected result is missing`
    );
    assert(
      Array.isArray(contractCase.reportFiles) && contractCase.reportFiles.length > 0,
      `${contractCase.id}: reportFiles are missing`
    );
    resolveContainedPath(projectRoot, contractCase.cwd, contractCase.id);
  }
}

function parseArguments(argv) {
  const mode = argv[0] ?? "cli";
  assert(mode === "cli" || mode === "action", `unsupported mode: ${mode}`);
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    assert(
      token === "--bin" ||
        token === "--expected-version" ||
        token === "--case" ||
        token === "--catalog",
      `unsupported argument: ${token}`
    );
    const value = argv[index + 1];
    assert(value, `${token} requires a value`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return { mode, options };
}

function resolveContainedPath(root, candidate, label) {
  const resolvedRoot = resolve(root);
  const resolved = resolve(resolvedRoot, candidate);
  const relation = relative(resolvedRoot, resolved);
  assert(
    relation === "" || (!relation.startsWith("..") && !isAbsolute(relation)),
    `${label}: path must stay inside ${resolvedRoot}`
  );
  return resolved;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(
      `external-consumer-conformance: ${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`external-consumer-conformance: ${message}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const temporaryPath = tmpdir();
  console.error(message.replaceAll(temporaryPath, "<temporary-directory>"));
  process.exitCode = 1;
});
