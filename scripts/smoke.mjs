import { existsSync } from "node:fs";
import { join } from "node:path";

const packageDirs = ["schema", "core", "cli", "report", "action"];
const missing = [];

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

console.log("smoke: ok");
