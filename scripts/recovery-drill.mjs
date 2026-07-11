import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const root = process.cwd();

const rootPackage = await readJson("package.json");
const releaseWorkflowText = await readText(".github/workflows/release.yml");
const releaseWorkflow = parse(releaseWorkflowText);
const disasterRecoveryText = await readText("docs/ops/disaster-recovery.md");
const rollbackText = await readText("docs/ops/rollback.md");
const releaseText = await readText("docs/ops/release.md");

assert(
  rootPackage.scripts?.["recovery-drill"] === "node scripts/recovery-drill.mjs",
  "package scripts must expose recovery-drill"
);
assert(
  rootPackage.scripts?.check?.includes("pnpm run recovery-drill"),
  "standard check gate must run recovery-drill"
);

assert(
  releaseWorkflow?.permissions?.contents === "write",
  "release workflow must retain contents: write for GitHub Release and Action tag recovery"
);
assert(
  releaseWorkflow?.permissions?.["id-token"] === "write",
  "release workflow must retain id-token: write for Trusted Publishing"
);
assertText(releaseWorkflowText, ".github/workflows/release.yml", [
  "node scripts/pack-smoke.mjs",
  "Capture release recovery state",
  "persist-credentials: false",
  "gh release create",
  "gh release delete",
  "node scripts/github-major-tag.mjs promote",
  "node scripts/github-major-tag.mjs restore",
  "Recover GitHub release state when npm publish fails"
]);

assertText(disasterRecoveryText, "docs/ops/disaster-recovery.md", [
  "no hosted runtime or persistent service state",
  "Restore user manifests from Git history.",
  "Regenerate reports from manifests.",
  "Deprecate or replace broken npm releases.",
  "Move floating Action tags back to a known-good commit when needed.",
  "recovery-drill"
]);

assertText(rollbackText, "docs/ops/rollback.md", [
  "Prefer a new patch release over unpublish when possible.",
  "Move `v0` or other floating major tags only after confirming the target commit is smoke-tested.",
  "No database exists in the MVP.",
  "The fixed release passes configured validations.",
  "recovery-drill"
]);

assertText(releaseText, "docs/ops/release.md", [
  "pnpm run release:trust:dry-run",
  "packed tarball install smoke",
  "Move or create the corresponding major Action tag",
  "restores the previous major Action tag target",
  "Smoke test package installation and Action usage from the released tag.",
  "recovery-drill"
]);

console.log(`recovery-drill: ok ${rootPackage.name}@${rootPackage.version}`);

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(join(root, path), "utf8");
}

function assertText(content, label, snippets) {
  const missing = snippets.filter((snippet) => !content.includes(snippet));
  assert(missing.length === 0, `${label} missing recovery drill text: ${missing.join(", ")}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`recovery-drill: ${message}`);
    process.exit(1);
  }
}
