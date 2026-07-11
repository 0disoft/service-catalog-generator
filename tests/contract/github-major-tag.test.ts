import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The production release helper runs directly as an ESM script.
import { promoteMajorTag, refUrls, restoreMajorTag } from "../../scripts/github-major-tag.mjs";

const repository = "0disoft/service-catalog-generator";
const tag = "v0";
const targetSha = "a".repeat(40);
const previousTarget = "b".repeat(40);
const token = "test-token";

describe("GitHub major Action tag operations", () => {
  it("updates an existing major tag", async () => {
    const fetchImpl = mockFetch(response(200), response(200));

    await expect(promoteMajorTag({ repository, tag, targetSha, token, fetchImpl })).resolves.toBe(
      "updated"
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `https://api.github.com/repos/${repository}/git/ref/tags/v0`,
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://api.github.com/repos/${repository}/git/refs/tags/v0`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sha: targetSha, force: true })
      })
    );
  });

  it("creates a missing major tag", async () => {
    const fetchImpl = mockFetch(response(404), response(201));

    await expect(promoteMajorTag({ repository, tag, targetSha, token, fetchImpl })).resolves.toBe(
      "created"
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://api.github.com/repos/${repository}/git/refs`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ref: "refs/tags/v0", sha: targetSha })
      })
    );
  });

  it("restores a previous target through the same upsert contract", async () => {
    const fetchImpl = mockFetch(response(200), response(200));

    await expect(
      restoreMajorTag({ repository, tag, previousTarget, token, fetchImpl })
    ).resolves.toBe("updated");

    expect(JSON.parse(String(fetchImpl.mock.calls[1][1].body))).toEqual({
      sha: previousTarget,
      force: true
    });
  });

  it("deletes a newly created tag and treats an absent tag as recovered", async () => {
    const deletedFetch = mockFetch(response(204));
    const absentFetch = mockFetch(response(404));

    await expect(
      restoreMajorTag({ repository, tag, previousTarget: "", token, fetchImpl: deletedFetch })
    ).resolves.toBe("deleted");
    await expect(
      restoreMajorTag({ repository, tag, previousTarget: "", token, fetchImpl: absentFetch })
    ).resolves.toBe("already-absent");
  });

  it("rejects malformed inputs before making a request", async () => {
    const fetchImpl = mockFetch();

    await expect(
      promoteMajorTag({ repository: "invalid", tag, targetSha, token, fetchImpl })
    ).rejects.toThrow("owner/name");
    await expect(
      promoteMajorTag({ repository, tag: "latest", targetSha, token, fetchImpl })
    ).rejects.toThrow("v<major>");
    await expect(
      promoteMajorTag({ repository, tag, targetSha: "abc", token, fetchImpl })
    ).rejects.toThrow("40-character");
    await expect(
      promoteMajorTag({ repository, tag, targetSha, token: "", fetchImpl })
    ).rejects.toThrow("GH_TOKEN");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports unexpected GitHub responses without exposing the token", async () => {
    const fetchImpl = mockFetch(response(500, "upstream failed"));

    const operation = promoteMajorTag({ repository, tag, targetSha, token, fetchImpl });
    await expect(operation).rejects.toThrow("returned 500: upstream failed");
    await expect(operation).rejects.not.toThrow(token);
  });

  it("uses singular lookup and plural mutation endpoints", () => {
    expect(refUrls(repository, tag)).toEqual({
      lookup: `https://api.github.com/repos/${repository}/git/ref/tags/v0`,
      update: `https://api.github.com/repos/${repository}/git/refs/tags/v0`,
      create: `https://api.github.com/repos/${repository}/git/refs`
    });
  });
});

function response(status: number, body = "") {
  return new Response(body || null, { status });
}

function mockFetch(...responses: Response[]) {
  return vi.fn(async (url: string, init: RequestInit) => {
    void url;
    void init;
    const next = responses.shift();
    if (!next) {
      throw new Error("Unexpected fetch call.");
    }
    return next;
  });
}
