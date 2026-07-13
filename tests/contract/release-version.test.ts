import { describe, expect, it } from "vitest";
// @ts-expect-error The production release helper runs directly as an ESM script.
import { normalizeReleaseVersion } from "../../scripts/release-version.mjs";

describe("release version normalization", () => {
  it("accepts release semver with an optional v prefix", () => {
    expect(normalizeReleaseVersion("0.5.17")).toBe("0.5.17");
    expect(normalizeReleaseVersion("v0.5.17")).toBe("0.5.17");
  });

  it.each([undefined, "", "V0.5.17", "0.5", "0.5.17-beta.1", " 0.5.17 "])(
    "rejects unsupported release input %s",
    (value) => {
      expect(() => normalizeReleaseVersion(value)).toThrow();
    }
  );
});
