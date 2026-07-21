import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runExternalConsumerConformance } from "./external-consumer-conformance.mjs";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packDirectory = await mkdtemp(join(tmpdir(), "scg-pack-"));

try {
  const firstPackDirectory = join(packDirectory, "first");
  const secondPackDirectory = join(packDirectory, "second");
  await mkdir(firstPackDirectory);
  await mkdir(secondPackDirectory);

  const firstTarballPath = pack(firstPackDirectory);
  const secondTarballPath = pack(secondPackDirectory);
  const firstHash = await sha256(firstTarballPath);
  const secondHash = await sha256(secondTarballPath);
  assert(
    firstHash === secondHash,
    `repeated package builds are not reproducible: ${firstHash} != ${secondHash}`
  );

  const result = await runExternalConsumerConformance({
    packageSpec: firstTarballPath,
    expectedVersion: packageJson.version
  });
  assert(
    result.output.includes(`cli ok ${packageJson.version}`),
    "external consumer verifier did not complete"
  );

  console.log(`pack-smoke: ok ${packageJson.name}@${packageJson.version} sha256=${firstHash}`);
} finally {
  await rm(packDirectory, { force: true, recursive: true });
}

function pack(destination) {
  const packOutput = execFileSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const tarballName = packOutput.split(/\r?\n/).at(-1);
  assert(tarballName, "pnpm pack did not report a tarball");

  const tarballPath = resolve(destination, tarballName);
  assert(existsSync(tarballPath), `packed tarball does not exist: ${tarballPath}`);
  return tarballPath;
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`pack-smoke: ${message}`);
    process.exit(1);
  }
}
