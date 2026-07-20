import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runExternalConsumerConformance } from "./external-consumer-conformance.mjs";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packDirectory = await mkdtemp(join(tmpdir(), "scg-pack-"));

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

  const result = await runExternalConsumerConformance({
    packageSpec: tarballPath,
    expectedVersion: packageJson.version
  });
  assert(
    result.output.includes(`cli ok ${packageJson.version}`),
    "external consumer verifier did not complete"
  );

  console.log(`pack-smoke: ok ${packageJson.name}@${packageJson.version}`);
} finally {
  await rm(packDirectory, { force: true, recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`pack-smoke: ${message}`);
    process.exit(1);
  }
}
