import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createLocalProvider, loadFlagSnapshotFile } from "@0disoft/openfeature-local-provider";
import { OpenFeature } from "@openfeature/server-sdk";

const expectedProviderVersion = "1.0.0";
const reportFlagKeys = {
  json: "scg.report.json.enabled",
  dot: "scg.report.dot.enabled",
  html: "scg.report.html.enabled"
};

export function selectEnabledReportFormats(flagValues) {
  const formats = Object.entries(reportFlagKeys)
    .filter(([, flagKey]) => flagValues[flagKey] === true)
    .map(([format]) => format);

  assert(formats.length > 0, "at least one report format must be enabled");
  return formats;
}

export async function runOpenFeatureConsumer({ root = process.cwd() } = {}) {
  const absoluteRoot = resolve(root);
  const flagsPath = resolve(absoluteRoot, "examples", "openfeature-consumer", "flags.json");
  const consumerRoot = resolve(absoluteRoot, "examples", "native-consumer");
  const outputName = ".catalog-openfeature";
  const outputPath = resolve(consumerRoot, outputName);
  const cliPath = resolve(absoluteRoot, "dist", "cli", "index.js");
  const providerPackagePath = resolve(
    absoluteRoot,
    "node_modules",
    "@0disoft",
    "openfeature-local-provider",
    "package.json"
  );

  await rm(outputPath, { recursive: true, force: true });

  const providerPackage = JSON.parse(await readFile(providerPackagePath, "utf8"));
  assert(
    providerPackage.version === expectedProviderVersion,
    `expected provider ${expectedProviderVersion}, received ${providerPackage.version}`
  );

  const snapshot = await loadFlagSnapshotFile(flagsPath);
  await OpenFeature.setProviderAndWait(
    createLocalProvider({
      name: "service-catalog-generator-consumer",
      snapshot
    })
  );

  try {
    const client = OpenFeature.getClient("service-catalog-generator");
    const evaluationEntries = await Promise.all(
      Object.values(reportFlagKeys).map(async (flagKey) => {
        const details = await client.getBooleanDetails(flagKey, false);
        assert(details.reason === "STATIC", `${flagKey}: expected STATIC evaluation reason`);
        return [flagKey, details.value];
      })
    );
    const flagValues = Object.fromEntries(evaluationEntries);
    const formats = selectEnabledReportFormats(flagValues);
    const formatArgs = formats.flatMap((format) => ["--format", format]);

    const output = execFileSync(
      process.execPath,
      [
        cliPath,
        "report",
        "--config",
        "scg.config.yaml",
        "--out",
        outputName,
        ...formatArgs,
        "--json",
        "--no-color"
      ],
      {
        cwd: consumerRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const catalog = JSON.parse(output);

    assert(catalog.schemaVersion === "scg.catalog/v1", "CLI catalog schema mismatch");
    assert(catalog.summary?.serviceCount === 2, "expected two native consumer services");
    assert(existsSync(resolve(outputPath, "catalog.json")), "JSON report was not written");
    assert(existsSync(resolve(outputPath, "report.html")), "HTML report was not written");
    assert(!existsSync(resolve(outputPath, "graph.dot")), "disabled DOT report was written");

    return {
      schemaVersion: "scg.openfeature-consumer-result/v1",
      providerVersion: providerPackage.version,
      formats,
      serviceCount: catalog.summary.serviceCount
    };
  } finally {
    await OpenFeature.close();
    await rm(outputPath, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`openfeature-consumer: ${message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOpenFeatureConsumer()
    .then((result) => {
      console.log(
        `openfeature-consumer: ok ${result.providerVersion} (${result.formats.join(", ")}; ${result.serviceCount} services)`
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
