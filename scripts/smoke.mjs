import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const packageDirs = ["schema", "core", "cli", "report", "action"];
const missing = [];
const rootPackagePath = join(process.cwd(), "package.json");
const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

for (const dir of packageDirs) {
  for (const file of ["package.json", "src/index.ts", "tsconfig.json"]) {
    const path = join(process.cwd(), "packages", dir, file);
    if (!existsSync(path)) {
      missing.push(path);
    }
  }
}

if (missing.length > 0) {
  console.error(
    `smoke: missing package skeleton files\n${missing.map((path) => `- ${path}`).join("\n")}`
  );
  process.exit(1);
}

const binPath = join(process.cwd(), rootPackage.bin.scg);
if (!existsSync(binPath)) {
  console.error(`smoke: missing built CLI binary\n- ${binPath}`);
  process.exit(1);
}

const binContents = await readFile(binPath, "utf8");
if (!binContents.startsWith("#!/usr/bin/env node")) {
  console.error(`smoke: built CLI binary is missing the node shebang\n- ${binPath}`);
  process.exit(1);
}

const version = execFileSync(process.execPath, [binPath, "--version"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

if (version !== rootPackage.version) {
  console.error(`smoke: CLI version mismatch\nexpected=${rootPackage.version}\nactual=${version}`);
  process.exit(1);
}

console.log("smoke: ok");
