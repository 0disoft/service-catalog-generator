import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const packageName = "@0disoft/service-catalog-generator";
const repository = "0disoft/service-catalog-generator";
const rootPackage = await readJson("package.json");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const version = args[0] ?? rootPackage.version;
const versionTag = `v${version}`;
const majorTag = `v${version.split(".")[0]}`;
const npmCommand = resolveNpmCommand();

assert(/^\d+\.\d+\.\d+$/.test(version), "version argument must be release semver");
assert(rootPackage.name === packageName, "package name must match release evidence package");

const npmPackage = npmJson(["view", `${packageName}@${version}`, "--json"]);
assert(npmPackage.version === version, `npm package ${packageName}@${version} must exist`);
assert(
  typeof npmPackage.dist?.integrity === "string" && npmPackage.dist.integrity.length > 0,
  "npm package must expose dist integrity"
);

const release = ghJson([
  "release",
  "view",
  versionTag,
  "--repo",
  repository,
  "--json",
  "tagName,isDraft,isPrerelease,url,publishedAt"
]);
assert(release.tagName === versionTag, `GitHub Release must use tag ${versionTag}`);
assert(release.isDraft === false, "GitHub Release must not be draft");
assert(release.isPrerelease === false, "GitHub Release must not be prerelease");
assert(
  typeof release.url === "string" && release.url.includes(versionTag),
  "GitHub Release URL missing"
);

const versionRef = ghJson(["api", `repos/${repository}/git/ref/tags/${versionTag}`]);
const majorRef = ghJson(["api", `repos/${repository}/git/ref/tags/${majorTag}`]);
const versionSha = versionRef.object?.sha;
const majorSha = majorRef.object?.sha;
assert(typeof versionSha === "string" && versionSha.length > 0, `${versionTag} tag must exist`);
assert(majorSha === versionSha, `${majorTag} must point to the same commit as ${versionTag}`);

const releaseRuns = ghJson([
  "run",
  "list",
  "--repo",
  repository,
  "--workflow",
  "release.yml",
  "--commit",
  versionSha,
  "--limit",
  "10",
  "--json",
  "databaseId,name,status,conclusion,headSha,url,event"
]);
const successfulReleaseRun = releaseRuns.find(
  (run) =>
    run.name === "release" &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    run.headSha === versionSha
);
assert(successfulReleaseRun, `release workflow must have succeeded for ${versionTag}`);

const cliVersion = await smokePublishedCli(version);
assert(cliVersion === version, `published CLI smoke returned ${cliVersion || "<empty>"}`);

console.log(
  [
    `release-evidence: ok ${packageName}@${version}`,
    `npm_integrity=${npmPackage.dist.integrity}`,
    `release_url=${release.url}`,
    `release_run=${successfulReleaseRun.url}`,
    `${majorTag}=${majorSha}`
  ].join("\n")
);

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

function ghJson(args) {
  return JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
}

function npmJson(args) {
  return JSON.parse(
    execFileSync(npmCommand.file, [...npmCommand.prefixArgs, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
}

async function smokePublishedCli(version) {
  const workspace = await mkdtemp(join(tmpdir(), "scg-release-evidence-"));
  try {
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
    return runInstalledCli(binPath, workspace);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

function runInstalledCli(binPath, workspace) {
  if (process.platform === "win32") {
    return execFileSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/c", "call", binPath, "--version"],
      {
        cwd: workspace,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();
  }

  return execFileSync(binPath, ["--version"], {
    cwd: workspace,
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
    console.error(`release-evidence: ${message}`);
    process.exit(1);
  }
}
