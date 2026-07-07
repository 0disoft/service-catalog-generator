import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();
const maxBytes = 1024 * 1024;
const patterns = [
  {
    name: "private-key",
    regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i
  },
  {
    name: "aws-access-key-id",
    regex: /AKIA[0-9A-Z]{16}/
  },
  {
    name: "github-token",
    regex: /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{40,})/
  },
  {
    name: "npm-token",
    regex: /npm_[A-Za-z0-9]{36,}/
  },
  {
    name: "openai-api-key",
    regex: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/
  }
];

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : trackedFiles();
const findings = [];

for (const file of files) {
  scanFile(file);
}

if (findings.length > 0) {
  console.error(
    [
      "secret-scan: secret-like values detected",
      ...findings.map((finding) => `- ${finding.file}:${finding.line}: ${finding.pattern}`)
    ].join("\n")
  );
  process.exit(1);
}

console.log(`secret-scan: ok ${files.length} files`);

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return output.split("\0").filter(Boolean);
}

function scanFile(file) {
  const absolutePath = resolve(root, file);
  const stats = statSync(absolutePath);
  if (!stats.isFile() || stats.size > maxBytes) {
    return;
  }

  const buffer = readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return;
  }

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: displayPath(absolutePath),
          line: index + 1,
          pattern: pattern.name
        });
      }
    }
  }
}

function displayPath(absolutePath) {
  return relative(root, absolutePath).replaceAll("\\", "/");
}
