import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const packageName = "@0disoft/service-catalog-generator";
const repository = "0disoft/service-catalog-generator";
const workflowFile = "release.yml";
const npmCommand = resolveNpmCommand();
const npmArgs = [
  "trust",
  "github",
  packageName,
  "--file",
  workflowFile,
  "--repository",
  repository,
  "--allow-publish",
  "--dry-run",
  "--json"
];

const output = execFileSync(npmCommand.file, [...npmCommand.prefixArgs, ...npmArgs], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const result = JSON.parse(output);
const permissions = Array.isArray(result.permissions) ? result.permissions : [];
const allowsPublish = permissions.some((permission) =>
  ["createPackage", "publishPackage", "publish"].includes(permission)
);

assert(result.package === packageName, "trusted publisher package mismatch");
assert(result.file === workflowFile, "trusted publisher workflow file mismatch");
assert(result.repository === repository, "trusted publisher repository mismatch");
assert(allowsPublish, "trusted publisher dry-run does not allow publish or package creation");

console.log(
  `trusted-publisher-dry-run: ok ${packageName} via ${repository}/.github/workflows/${workflowFile}`
);

function assert(condition, message) {
  if (!condition) {
    console.error(`trusted-publisher-dry-run: ${message}`);
    process.exit(1);
  }
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
