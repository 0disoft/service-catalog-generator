const MAX_TAG_DEPTH = 8;

export async function resolveGitHubTagCommit(object, loadTag, depth = 0) {
  if (!object || typeof object.sha !== "string" || typeof object.type !== "string") {
    throw new Error("GitHub tag ref has an invalid target object");
  }
  if (object.type === "commit") {
    return object.sha;
  }
  if (object.type !== "tag") {
    throw new Error(`GitHub tag ref points to unsupported object type ${object.type}`);
  }
  if (depth >= MAX_TAG_DEPTH) {
    throw new Error("GitHub annotated tag chain exceeds the supported depth");
  }

  const tag = await loadTag(object.sha);
  return resolveGitHubTagCommit(tag?.object, loadTag, depth + 1);
}
