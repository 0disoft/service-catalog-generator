import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeReleaseVersion } from "./release-version.mjs";

const DEFAULT_ATTEMPTS = 6;
const DEFAULT_DELAY_MS = 5_000;

export async function observeNpmVersion({
  packageName,
  version,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep
}) {
  validateInputs({ packageName, version, attempts, delayMs });
  const url = npmVersionUrl(packageName, version);
  let uncertain = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (response.status === 200) {
        const payload = await readJson(response);
        return payload?.version === version ? "published" : "unknown";
      }

      if (response.status !== 404) {
        uncertain = true;
      }
    } catch {
      uncertain = true;
    }

    if (attempt < attempts) {
      await sleepImpl(delayMs);
    }
  }

  return uncertain ? "unknown" : "absent";
}

export function npmVersionUrl(packageName, version) {
  validatePackageName(packageName);
  validateVersion(version);
  return `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function validateInputs({ packageName, version, attempts, delayMs }) {
  validatePackageName(packageName);
  validateVersion(version);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
    throw new Error("Attempts must be an integer between 1 and 20.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
    throw new Error("Delay must be an integer between 0 and 60000 milliseconds.");
  }
}

function validatePackageName(packageName) {
  if (!/^@?[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?$/.test(packageName)) {
    throw new Error("NPM_PACKAGE_NAME is invalid.");
  }
}

function validateVersion(version) {
  try {
    if (normalizeReleaseVersion(version) !== version) {
      throw new Error();
    }
  } catch {
    throw new Error("NPM_PACKAGE_VERSION must be stable or prerelease semver.");
  }
}

function sleep(delayMs) {
  return delay(delayMs);
}

async function main() {
  const mode = process.argv[2];
  const packageName = process.env.NPM_PACKAGE_NAME ?? "";
  const version = process.env.NPM_PACKAGE_VERSION ?? "";
  const state = await observeNpmVersion({ packageName, version });

  if (mode === "state") {
    console.log(state);
    return;
  }

  if (mode === "expect-absent") {
    if (state !== "absent") {
      throw new Error(`npm version preflight expected absent but observed ${state}.`);
    }
    console.log(`npm-version: absent ${packageName}@${version}`);
    return;
  }

  throw new Error("Usage: node scripts/npm-release-visibility.mjs <state|expect-absent>");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "npm visibility check failed.");
    process.exitCode = 1;
  });
}
