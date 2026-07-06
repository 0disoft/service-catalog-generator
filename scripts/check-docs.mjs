import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "AGENTS.md",
  "VALIDATION.md",
  "CHECKLIST.md",
  "docs/product/02-spec.md",
  "docs/adr/0003-single-public-monorepo.md",
  "docs/adr/0004-typescript-node24-runtime.md",
  "docs/adr/0005-service-manifest-schema-v1alpha1.md",
  "docs/adr/0006-diagnostics-and-exit-code-contract.md",
  "docs/adr/0007-no-network-and-no-telemetry-by-default.md",
  "docs/adr/0008-static-report-security-boundary.md",
  "docs/adr/0009-release-and-package-provenance.md",
  "docs/adr/0010-generated-artifacts-are-never-source-truth.md"
];

const requiredText = new Map([
  [
    "docs/product/02-spec.md",
    ["scg.service/v1alpha1", "@0disoft/service-catalog-generator", "Apache-2.0"]
  ],
  ["docs/cli/output-and-exit-codes.md", ["Catalog validation error", "internal unexpected error"]],
  ["docs/github-action/permissions.md", ["contents: read"]]
]);

const missingFiles = requiredFiles.filter((file) => !existsSync(join(process.cwd(), file)));
if (missingFiles.length > 0) {
  console.error(`Missing required docs:\n${missingFiles.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}

const missingText = [];
for (const [file, snippets] of requiredText.entries()) {
  const content = readFileSync(join(process.cwd(), file), "utf8");
  const normalizedContent = content.toLowerCase();
  for (const snippet of snippets) {
    if (!normalizedContent.includes(snippet.toLowerCase())) {
      missingText.push(`${file}: ${snippet}`);
    }
  }
}

if (missingText.length > 0) {
  console.error(`Missing required doc text:\n${missingText.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("docs: ok");
