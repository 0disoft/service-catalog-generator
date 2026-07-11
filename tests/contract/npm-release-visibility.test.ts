import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The production release helper runs directly as an ESM script.
import { npmVersionUrl, observeNpmVersion } from "../../scripts/npm-release-visibility.mjs";

const packageName = "@0disoft/service-catalog-generator";
const version = "0.5.12";

describe("npm release visibility", () => {
  it("recognizes a published version", async () => {
    const fetchImpl = mockFetch(jsonResponse(200, { version }));

    await expect(
      observeNpmVersion({ packageName, version, attempts: 1, delayMs: 0, fetchImpl })
    ).resolves.toBe("published");
  });

  it("recognizes an absent version only after every attempt returns 404", async () => {
    const fetchImpl = mockFetch(response(404), response(404), response(404));
    const sleepImpl = vi.fn(async () => undefined);

    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 3,
        delayMs: 10,
        fetchImpl,
        sleepImpl
      })
    ).resolves.toBe("absent");
    expect(sleepImpl).toHaveBeenCalledTimes(2);
  });

  it("handles delayed registry visibility", async () => {
    const fetchImpl = mockFetch(response(404), jsonResponse(200, { version }));

    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 2,
        delayMs: 0,
        fetchImpl,
        sleepImpl: async () => undefined
      })
    ).resolves.toBe("published");
  });

  it("returns unknown for registry errors, network failures, and malformed metadata", async () => {
    const networkFailure = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 1,
        delayMs: 0,
        fetchImpl: mockFetch(response(503))
      })
    ).resolves.toBe("unknown");
    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 1,
        delayMs: 0,
        fetchImpl: networkFailure
      })
    ).resolves.toBe("unknown");
    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 1,
        delayMs: 0,
        fetchImpl: mockFetch(jsonResponse(200, { version: "0.0.0" }))
      })
    ).resolves.toBe("unknown");
    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 1,
        delayMs: 0,
        fetchImpl: mockFetch(new Response("not json", { status: 200 }))
      })
    ).resolves.toBe("unknown");
  });

  it("does not downgrade an uncertain observation to absent", async () => {
    const fetchImpl = mockFetch(response(503), response(404));

    await expect(
      observeNpmVersion({
        packageName,
        version,
        attempts: 2,
        delayMs: 0,
        fetchImpl,
        sleepImpl: async () => undefined
      })
    ).resolves.toBe("unknown");
  });

  it("encodes scoped package names and rejects invalid input", async () => {
    expect(npmVersionUrl(packageName, version)).toBe(
      "https://registry.npmjs.org/%400disoft%2Fservice-catalog-generator/0.5.12"
    );
    await expect(
      observeNpmVersion({ packageName: "Bad Name", version, attempts: 1, delayMs: 0 })
    ).rejects.toThrow("NPM_PACKAGE_NAME");
    await expect(
      observeNpmVersion({ packageName, version: "latest", attempts: 1, delayMs: 0 })
    ).rejects.toThrow("release semver");
  });
});

function response(status: number) {
  return new Response(null, { status });
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
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
