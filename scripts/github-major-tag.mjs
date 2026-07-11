import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

export async function promoteMajorTag({
  repository,
  tag,
  targetSha,
  token,
  fetchImpl = globalThis.fetch
}) {
  validateInputs({ repository, tag, targetSha, token });
  const urls = refUrls(repository, tag);
  const lookup = await request(fetchImpl, urls.lookup, token, { method: "GET" }, [200, 404]);

  if (lookup.status === 200) {
    await request(
      fetchImpl,
      urls.update,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: targetSha, force: true })
      },
      [200]
    );
    return "updated";
  }

  await request(
    fetchImpl,
    urls.create,
    token,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: targetSha })
    },
    [201]
  );
  return "created";
}

export async function restoreMajorTag({
  repository,
  tag,
  previousTarget,
  token,
  fetchImpl = globalThis.fetch
}) {
  if (previousTarget) {
    return promoteMajorTag({ repository, tag, targetSha: previousTarget, token, fetchImpl });
  }

  validateInputs({ repository, tag, token });
  const { update } = refUrls(repository, tag);
  const response = await request(fetchImpl, update, token, { method: "DELETE" }, [204, 404]);
  return response.status === 204 ? "deleted" : "already-absent";
}

export function refUrls(repository, tag) {
  validateRepository(repository);
  validateTag(tag);
  const encodedTag = encodeURIComponent(tag);
  const base = `${API_ROOT}/repos/${repository}`;
  return {
    lookup: `${base}/git/ref/tags/${encodedTag}`,
    update: `${base}/git/refs/tags/${encodedTag}`,
    create: `${base}/git/refs`
  };
}

async function request(fetchImpl, url, token, init, expectedStatuses) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": API_VERSION
    }
  });

  if (!expectedStatuses.includes(response.status)) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new Error(
      `GitHub ref request failed: ${init.method} ${url} returned ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }

  return response;
}

function validateInputs({ repository, tag, targetSha, token }) {
  validateRepository(repository);
  validateTag(tag);
  if (!token) {
    throw new Error("GH_TOKEN is required.");
  }
  if (targetSha !== undefined && !/^[0-9a-f]{40}$/.test(targetSha)) {
    throw new Error("Target SHA must be a 40-character lowercase Git commit SHA.");
  }
}

function validateRepository(repository) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use owner/name format.");
  }
}

function validateTag(tag) {
  if (!/^v\d+$/.test(tag)) {
    throw new Error("Major Action tag must use v<major> format.");
  }
}

async function main() {
  const mode = process.argv[2];
  const common = {
    repository: process.env.GITHUB_REPOSITORY ?? "",
    tag: process.env.MAJOR_TAG ?? "",
    token: process.env.GH_TOKEN ?? ""
  };

  if (mode === "promote") {
    const result = await promoteMajorTag({
      ...common,
      targetSha: process.env.TARGET_SHA ?? ""
    });
    console.log(`major-tag: ${result} ${common.tag}`);
    return;
  }

  if (mode === "restore") {
    const result = await restoreMajorTag({
      ...common,
      previousTarget: process.env.PREVIOUS_MAJOR_TARGET ?? ""
    });
    console.log(`major-tag: ${result} ${common.tag}`);
    return;
  }

  throw new Error("Usage: node scripts/github-major-tag.mjs <promote|restore>");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Major tag operation failed.");
    process.exitCode = 1;
  });
}
