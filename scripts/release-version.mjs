const RELEASE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

export function normalizeReleaseVersion(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Release version is required.");
  }

  const version = value.startsWith("v") ? value.slice(1) : value;
  if (!RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(
      "Release version must be stable or prerelease semver with an optional v prefix."
    );
  }
  return version;
}

export function isPrereleaseVersion(value) {
  return normalizeReleaseVersion(value).includes("-");
}

export function npmDistTagForVersion(value) {
  return isPrereleaseVersion(value) ? "next" : "latest";
}
