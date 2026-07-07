import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const root = process.cwd();
const workspacePackages = ["schema", "core", "cli", "report", "action"];
const expectedRepository = "git+https://github.com/0disoft/service-catalog-generator.git";

const rootPackage = await readJson("package.json");
const actionMetadata = parse(await readText("action.yml"));
const changelogText = await readText("CHANGELOG.md");
const cliSource = await readText("packages/cli/src/index.ts");
const coreScanSource = await readText("packages/core/src/scan.ts");
const releaseWorkflowText = await readText(".github/workflows/release.yml");
const releaseWorkflow = parse(releaseWorkflowText);

assert(
  rootPackage.name === "@0disoft/service-catalog-generator",
  "package name must match npm package"
);
assert(rootPackage.private !== true, "root package must be publishable");
assert(rootPackage.license === "Apache-2.0", "package license must be Apache-2.0");
assert(rootPackage.repository?.url === expectedRepository, "repository URL must match GitHub repo");
assert(rootPackage.publishConfig?.access === "public", "scoped package must publish as public");
assert(isReleaseVersion(rootPackage.version), "package version must be a release semver");
assert(rootPackage.files?.includes("dist"), "published files must include dist");
assert(rootPackage.files?.includes("README.md"), "published files must include README.md");
assert(rootPackage.files?.includes("CHANGELOG.md"), "published files must include CHANGELOG.md");
assert(rootPackage.files?.includes("LICENSE"), "published files must include LICENSE");
assert(
  changelogText.includes(`## ${rootPackage.version}`),
  "CHANGELOG.md must document package version"
);
assert(
  cliSource.includes(`export const cliVersion = "${rootPackage.version}"`),
  "CLI version constant must match package version"
);
assert(
  coreScanSource.includes(`const DEFAULT_TOOL_VERSION = "${rootPackage.version}"`),
  "core default tool version must match package version"
);

for (const packageName of workspacePackages) {
  const packageJson = await readJson(join("packages", packageName, "package.json"));
  assert(
    packageJson.version === rootPackage.version,
    `${packageName} version must match root version`
  );
  assert(packageJson.private === true, `${packageName} package must stay private`);
}

assert(actionMetadata?.runs?.using === "node24", "action runtime must be node24");
assert(
  actionMetadata?.runs?.main === "dist/action/index.cjs",
  "action entrypoint must use tracked bundle"
);

assert(
  releaseWorkflow?.permissions?.contents === "write",
  "release workflow needs contents: write"
);
assert(
  releaseWorkflow?.permissions?.["id-token"] === "write",
  "release workflow needs id-token: write"
);
assert(
  !/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.NPM/i.test(releaseWorkflowText),
  "release must not use npm tokens"
);

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${rootPackage.version}`;
  assert(
    process.env.GITHUB_REF_NAME === expectedTag,
    `release tag ${process.env.GITHUB_REF_NAME ?? "<missing>"} must match package version ${expectedTag}`
  );
}

console.log(`release-check: ok ${rootPackage.name}@${rootPackage.version}`);

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(join(root, path), "utf8");
}

function isReleaseVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`release-check: ${message}`);
    process.exit(1);
  }
}
