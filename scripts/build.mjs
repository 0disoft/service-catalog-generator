import { readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

await rm(join(root, "dist", "cli"), { recursive: true, force: true });
await rm(join(root, "dist", "action"), { recursive: true, force: true });

runTsup([
  "packages/cli/src/index.ts",
  "--format",
  "esm",
  "--platform",
  "node",
  "--target",
  "node24",
  "--sourcemap",
  "--external",
  "yaml",
  "--out-dir",
  "dist/cli"
]);

runTsup([
  "packages/action/src/index.ts",
  "--format",
  "cjs",
  "--platform",
  "node",
  "--target",
  "node24",
  "--out-dir",
  "dist/action"
]);

await stripTrailingWhitespace(join(root, "dist", "action", "index.cjs"));

function runTsup(args) {
  execFileSync(
    process.execPath,
    [join(root, "node_modules", "tsup", "dist", "cli-default.js"), ...args],
    {
      cwd: root,
      stdio: "inherit"
    }
  );
}

async function stripTrailingWhitespace(path) {
  const contents = await readFile(path, "utf8");
  await writeFile(path, contents.replace(/[ \t]+$/gm, ""), "utf8");
}
