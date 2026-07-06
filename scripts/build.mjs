import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "tsup";

const root = process.cwd();

await rm(join(root, "dist", "cli"), { recursive: true, force: true });
await rm(join(root, "dist", "action"), { recursive: true, force: true });

await build({
  entry: ["packages/cli/src/index.ts"],
  external: ["yaml"],
  format: ["esm"],
  outDir: "dist/cli",
  platform: "node",
  sourcemap: true,
  target: "node24"
});

await build({
  entry: ["packages/action/src/index.ts"],
  format: ["cjs"],
  noExternal: ["yaml"],
  outDir: "dist/action",
  platform: "node",
  target: "node24"
});

await stripTrailingWhitespace(join(root, "dist", "action", "index.cjs"));

async function stripTrailingWhitespace(path) {
  const contents = await readFile(path, "utf8");
  await writeFile(path, contents.replace(/[ \t]+$/gm, ""), "utf8");
}
