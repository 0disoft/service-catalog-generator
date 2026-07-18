import { describe, expect, it } from "vitest";
import {
  isPrereleaseVersion,
  normalizeReleaseVersion,
  npmDistTagForVersion
} from "../../scripts/release-version.mjs";

describe("release version normalization", () => {
  it("accepts release semver with an optional v prefix", () => {
    expect(normalizeReleaseVersion("0.5.17")).toBe("0.5.17");
    expect(normalizeReleaseVersion("v0.5.17")).toBe("0.5.17");
    expect(normalizeReleaseVersion("1.0.0-rc.1")).toBe("1.0.0-rc.1");
    expect(normalizeReleaseVersion("v1.0.0-beta.2")).toBe("1.0.0-beta.2");
  });

  it.each([undefined, "", "V0.5.17", "0.5", "1.0.0-01", "1.0.0-rc_1", "1.0.0+build.1", " 0.5.17 "])(
    "rejects unsupported release input %s",
    (value) => {
      expect(() => normalizeReleaseVersion(value)).toThrow();
    }
  );

  it("routes prereleases away from npm latest", () => {
    expect(isPrereleaseVersion("1.0.0-rc.1")).toBe(true);
    expect(isPrereleaseVersion("1.0.0")).toBe(false);
    expect(npmDistTagForVersion("1.0.0-rc.1")).toBe("next");
    expect(npmDistTagForVersion("1.0.0")).toBe("latest");
  });
});
