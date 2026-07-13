import { describe, expect, it, vi } from "vitest";
import { resolveGitHubTagCommit } from "../../scripts/github-tag-target.mjs";

describe("GitHub tag target resolution", () => {
  it("returns a lightweight tag commit without another API lookup", async () => {
    const loadTag = vi.fn();

    await expect(
      resolveGitHubTagCommit({ type: "commit", sha: "commit-sha" }, loadTag)
    ).resolves.toBe("commit-sha");
    expect(loadTag).not.toHaveBeenCalled();
  });

  it("dereferences annotated and nested tags to the commit", async () => {
    const loadTag = vi.fn(async (sha: string) =>
      sha === "outer-tag"
        ? { object: { type: "tag", sha: "inner-tag" } }
        : { object: { type: "commit", sha: "commit-sha" } }
    );

    await expect(resolveGitHubTagCommit({ type: "tag", sha: "outer-tag" }, loadTag)).resolves.toBe(
      "commit-sha"
    );
    expect(loadTag).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported targets and unbounded tag chains", async () => {
    await expect(
      resolveGitHubTagCommit({ type: "blob", sha: "blob-sha" }, vi.fn())
    ).rejects.toThrow("unsupported object type blob");
    await expect(
      resolveGitHubTagCommit({ type: "tag", sha: "loop" }, async () => ({
        object: { type: "tag", sha: "loop" }
      }))
    ).rejects.toThrow("exceeds the supported depth");
  });
});
