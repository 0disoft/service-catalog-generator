export function normalizeReleaseVersion(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Release version is required.");
  }

  const version = value.startsWith("v") ? value.slice(1) : value;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Release version must be semver with an optional v prefix.");
  }
  return version;
}
