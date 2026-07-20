import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { observeNpmVersion } from "./npm-release-visibility.mjs";
import { normalizeReleaseVersion } from "./release-version.mjs";
import { runExternalConsumerConformance } from "./external-consumer-conformance.mjs";

const root = process.cwd();
const packageName = "@0disoft/service-catalog-generator";
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const version = normalizeReleaseVersion(
  args[0] ?? process.env.RELEASE_VERSION ?? rootPackage.version
);
const registryState = await observeNpmVersion({
  packageName,
  version,
  attempts: 12,
  delayMs: 5_000
});
assert(registryState === "published", `npm registry state is ${registryState}`);

const result = await runExternalConsumerConformance({
  packageSpec: version,
  expectedVersion: version
});
assert(result.output.includes(`cli ok ${version}`), "external consumer verifier did not complete");

console.log(
  `registry-smoke: ok ${packageName}@${version} (${process.platform}, native=2/1/0, legacy=1/0/0, mixed=2/1/0)`
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`registry-smoke: ${message}`);
  }
}
