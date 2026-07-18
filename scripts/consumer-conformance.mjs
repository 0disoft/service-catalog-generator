import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInstalledCli } from "./package-smoke-helpers.mjs";

const manifestSchemaVersion = "scg.consumer-conformance/v1";
const resultSchemaVersion = "scg.consumer-conformance-result/v1";

export async function runConsumerConformance({
  root,
  manifestPath,
  invokeCli,
  expectedToolVersion,
  verifyReports = false
}) {
  const absoluteRoot = resolve(root);
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  validateManifest(manifest);

  const results = [];
  let observedToolVersion = expectedToolVersion;

  for (const contractCase of manifest.cases) {
    const cwd = resolveContainedPath(absoluteRoot, contractCase.cwd, contractCase.id);
    const output = await invokeCli({
      cwd,
      args: [
        verifyReports ? "report" : "check",
        "--config",
        contractCase.config,
        "--json",
        "--no-color"
      ]
    });
    const snapshot = parseSnapshot(output, contractCase.id);
    const actual = selectContractResult(snapshot);

    if (observedToolVersion === undefined) {
      observedToolVersion = snapshot.tool.version;
    }
    assert(
      snapshot.tool.version === observedToolVersion,
      `${contractCase.id}: tool version ${snapshot.tool.version} does not match ${observedToolVersion}`
    );
    assert(
      isDeepStrictEqual(actual, contractCase.expected),
      `${contractCase.id}: conformance mismatch\nexpected=${JSON.stringify(contractCase.expected)}\nactual=${JSON.stringify(actual)}`
    );
    if (verifyReports) {
      for (const reportFile of contractCase.reportFiles) {
        assert(
          existsSync(resolveContainedPath(cwd, reportFile, contractCase.id)),
          `${contractCase.id}: report file is missing: ${reportFile}`
        );
      }
    }

    results.push({ id: contractCase.id, ...actual });
  }

  return {
    schemaVersion: resultSchemaVersion,
    toolVersion: observedToolVersion,
    caseCount: results.length,
    cases: results
  };
}

export function selectContractResult(snapshot) {
  assert(snapshot?.schemaVersion === "scg.catalog/v1", "catalog schema version mismatch");
  assert(typeof snapshot?.tool?.version === "string", "catalog tool version is missing");
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

export async function verifyActionConformance({
  manifestPath,
  caseId,
  catalogPath,
  actionOutputs
}) {
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  validateManifest(manifest);
  const contractCase = manifest.cases.find((candidate) => candidate.id === caseId);
  assert(contractCase, `unknown action conformance case: ${caseId}`);

  const snapshot = JSON.parse(await readFile(resolve(catalogPath), "utf8"));
  const actual = selectContractResult(snapshot);
  assert(
    isDeepStrictEqual(actual, contractCase.expected),
    `${caseId}: action catalog mismatch\nexpected=${JSON.stringify(contractCase.expected)}\nactual=${JSON.stringify(actual)}`
  );
  assert(
    String(actual.summary.serviceCount) === actionOutputs.serviceCount,
    `${caseId}: action service-count output mismatch`
  );
  assert(
    String(actual.summary.errorCount) === actionOutputs.errorCount,
    `${caseId}: action error-count output mismatch`
  );
  assert(
    String(actual.summary.warningCount) === actionOutputs.warningCount,
    `${caseId}: action warning-count output mismatch`
  );

  return { id: caseId, ...actual };
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
    for (const reportFile of contractCase.reportFiles) {
      assert(
        typeof reportFile === "string" && reportFile.length > 0,
        `${contractCase.id}: reportFiles contains an invalid path`
      );
    }
  }
}

function resolveContainedPath(root, candidate, caseId) {
  const resolved = resolve(root, candidate);
  const relation = relative(root, resolved);
  assert(
    relation === "" || (!relation.startsWith("..") && !isAbsolute(relation)),
    `${caseId}: cwd must stay inside the conformance root`
  );
  return resolved;
}

function parseSnapshot(output, caseId) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `${caseId}: CLI did not emit valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (
      token === "--root" ||
      token === "--manifest" ||
      token === "--bin" ||
      token === "--action-case" ||
      token === "--catalog"
    ) {
      const value = argv[index + 1];
      assert(value, `${token} requires a value`);
      options[token.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`consumer-conformance: unsupported argument ${token}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = resolve(options.root ?? process.cwd());
  const manifestPath = resolve(root, options.manifest ?? "examples/consumer-conformance.json");
  const binPath = resolveContainedPath(root, options.bin ?? join("dist", "cli", "index.js"), "cli");

  if (options["action-case"]) {
    assert(options.catalog, "--action-case requires --catalog");
    const result = await verifyActionConformance({
      manifestPath,
      caseId: options["action-case"],
      catalogPath: resolve(root, options.catalog),
      actionOutputs: {
        serviceCount: process.env.SCG_ACTION_SERVICE_COUNT,
        errorCount: process.env.SCG_ACTION_ERROR_COUNT,
        warningCount: process.env.SCG_ACTION_WARNING_COUNT
      }
    });
    console.log(`consumer-conformance: action ok ${result.id}`);
    return;
  }

  const result = await runConsumerConformance({
    root,
    manifestPath,
    invokeCli: ({ cwd, args }) =>
      binPath.endsWith(".js")
        ? execFileSync(process.execPath, [binPath, ...args], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }).trim()
        : runInstalledCli(binPath, cwd, args)
  });

  console.log(
    `consumer-conformance: ok ${result.toolVersion} (${result.cases.map((entry) => entry.id).join(", ")})`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`consumer-conformance: ${message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
