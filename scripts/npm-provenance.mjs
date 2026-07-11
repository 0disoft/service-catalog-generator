const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";

export function verifyNpmProvenance({
  attestationDocument,
  packageName,
  version,
  integrity,
  repository,
  workflowPath,
  commitSha
}) {
  const attestations = attestationDocument?.attestations;
  assert(Array.isArray(attestations), "attestation document must contain attestations");

  const attestation = attestations.find(
    (candidate) => candidate?.predicateType === SLSA_PROVENANCE_V1
  );
  assert(attestation, "SLSA provenance v1 attestation is missing");

  const encodedPayload = attestation.bundle?.dsseEnvelope?.payload;
  assert(
    typeof encodedPayload === "string" && encodedPayload.length > 0,
    "DSSE payload is missing"
  );

  const statement = decodeStatement(encodedPayload);
  assert(statement._type === "https://in-toto.io/Statement/v1", "in-toto statement type mismatch");
  assert(statement.predicateType === SLSA_PROVENANCE_V1, "DSSE predicate type mismatch");

  const expectedSubject = npmPurl(packageName, version);
  const expectedDigest = integrityToHex(integrity);
  const subject = statement.subject?.find((candidate) => candidate?.name === expectedSubject);
  assert(subject, `provenance subject ${expectedSubject} is missing`);
  assert(
    subject.digest?.sha512 === expectedDigest,
    "provenance subject digest does not match npm integrity"
  );

  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow;
  assert(
    workflow?.repository === `https://github.com/${repository}`,
    "provenance repository mismatch"
  );
  assert(workflow?.path === workflowPath, "provenance workflow path mismatch");
  assert(workflow?.ref === `refs/tags/v${version}`, "provenance tag ref mismatch");

  const dependencies = statement.predicate?.buildDefinition?.resolvedDependencies;
  assert(Array.isArray(dependencies), "provenance resolved dependencies are missing");
  const source = dependencies.find(
    (dependency) => dependency?.uri === `git+https://github.com/${repository}@refs/tags/v${version}`
  );
  assert(source, "provenance source dependency is missing");
  assert(source.digest?.gitCommit === commitSha, "provenance commit SHA mismatch");

  return {
    predicateType: statement.predicateType,
    subject: expectedSubject,
    digest: expectedDigest,
    repository: workflow.repository,
    workflowPath: workflow.path,
    ref: workflow.ref,
    commitSha: source.digest.gitCommit
  };
}

export function npmPurl(packageName, version) {
  const encodedName = packageName.startsWith("@") ? `%40${packageName.slice(1)}` : packageName;
  return `pkg:npm/${encodedName}@${version}`;
}

export function integrityToHex(integrity) {
  const match = /^sha512-(.+)$/.exec(integrity);
  assert(match, "npm integrity must use sha512");
  const digest = Buffer.from(match[1], "base64");
  assert(digest.length === 64, "npm sha512 integrity digest has invalid length");
  return digest.toString("hex");
}

function decodeStatement(encodedPayload) {
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8"));
  } catch {
    throw new Error("DSSE payload is not valid base64-encoded JSON");
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
