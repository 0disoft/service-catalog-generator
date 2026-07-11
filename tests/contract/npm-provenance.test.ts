import { describe, expect, it } from "vitest";
// @ts-expect-error The production release helper runs directly as an ESM script.
import { integrityToHex, npmPurl, verifyNpmProvenance } from "../../scripts/npm-provenance.mjs";

const packageName = "@0disoft/service-catalog-generator";
const version = "0.5.12";
const repository = "0disoft/service-catalog-generator";
const workflowPath = ".github/workflows/release.yml";
const commitSha = "a".repeat(40);
const digestBytes = Buffer.alloc(64, 7);
const integrity = `sha512-${digestBytes.toString("base64")}`;

describe("npm provenance contract", () => {
  it("verifies package, digest, workflow, tag, and commit identity", () => {
    const result = verifyNpmProvenance({
      attestationDocument: documentFor(statement()),
      packageName,
      version,
      integrity,
      repository,
      workflowPath,
      commitSha
    });

    expect(result).toEqual({
      predicateType: "https://slsa.dev/provenance/v1",
      subject: "pkg:npm/%400disoft/service-catalog-generator@0.5.12",
      digest: digestBytes.toString("hex"),
      repository: `https://github.com/${repository}`,
      workflowPath,
      ref: "refs/tags/v0.5.12",
      commitSha
    });
  });

  it("rejects missing SLSA provenance and malformed payloads", () => {
    expect(() =>
      verifyNpmProvenance({
        attestationDocument: { attestations: [] },
        packageName,
        version,
        integrity,
        repository,
        workflowPath,
        commitSha
      })
    ).toThrow("SLSA provenance");

    expect(() =>
      verifyNpmProvenance({
        attestationDocument: documentFor(undefined, "not-json"),
        packageName,
        version,
        integrity,
        repository,
        workflowPath,
        commitSha
      })
    ).toThrow("base64-encoded JSON");
  });

  it.each([
    ["digest", { subjectDigest: "0".repeat(128) }, "digest"],
    ["repository", { repository: "other/repo" }, "repository"],
    ["workflow", { workflowPath: ".github/workflows/other.yml" }, "workflow path"],
    ["tag", { versionRef: "refs/tags/v9.9.9" }, "tag ref"],
    ["commit", { commitSha: "b".repeat(40) }, "commit SHA"]
  ])("rejects %s identity drift", (_name, overrides, expectedMessage) => {
    expect(() =>
      verifyNpmProvenance({
        attestationDocument: documentFor(statement(overrides)),
        packageName,
        version,
        integrity,
        repository,
        workflowPath,
        commitSha
      })
    ).toThrow(expectedMessage);
  });

  it("normalizes scoped package purls and sha512 integrity", () => {
    expect(npmPurl(packageName, version)).toBe(
      "pkg:npm/%400disoft/service-catalog-generator@0.5.12"
    );
    expect(integrityToHex(integrity)).toBe(digestBytes.toString("hex"));
    expect(() => integrityToHex("sha256-invalid")).toThrow("sha512");
  });
});

function documentFor(payload = statement(), rawPayload?: string) {
  return {
    attestations: [
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          dsseEnvelope: {
            payload: Buffer.from(rawPayload ?? JSON.stringify(payload)).toString("base64")
          }
        }
      }
    ]
  };
}

function statement(
  overrides: {
    subjectDigest?: string;
    repository?: string;
    workflowPath?: string;
    versionRef?: string;
    commitSha?: string;
  } = {}
) {
  const sourceRepository = overrides.repository ?? repository;
  const versionRef = overrides.versionRef ?? `refs/tags/v${version}`;
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: npmPurl(packageName, version),
        digest: { sha512: overrides.subjectDigest ?? digestBytes.toString("hex") }
      }
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: versionRef,
            repository: `https://github.com/${sourceRepository}`,
            path: overrides.workflowPath ?? workflowPath
          }
        },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/${sourceRepository}@${versionRef}`,
            digest: { gitCommit: overrides.commitSha ?? commitSha }
          }
        ]
      }
    }
  };
}
