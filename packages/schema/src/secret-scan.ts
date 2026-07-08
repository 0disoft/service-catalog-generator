import type { RefinementCtx } from "zod";

const SECRET_KEY_PATTERN = /(?:api[_-]?key|token|secret|password|credential|private[_-]?key)/i;
const SECRET_VALUE_PATTERN =
  /(?:sk-(?:proj-)?[a-z0-9_-]{20,}|sk_(?:live|test)_[a-z0-9_]{12,}|github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9_]{20,}|npm_[a-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

export function addSecretLikeIssues(
  value: unknown,
  ctx: RefinementCtx,
  path: Array<string | number> = []
): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value)) {
      ctx.addIssue({
        code: "custom",
        path,
        message: "Manifest values must not contain secret-like data."
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => addSecretLikeIssues(item, ctx, [...path, index]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = [...path, key];
    if (SECRET_KEY_PATTERN.test(key)) {
      ctx.addIssue({
        code: "custom",
        path: nestedPath,
        message: "Manifest keys must not contain secret-like names."
      });
    }
    addSecretLikeIssues(nestedValue, ctx, nestedPath);
  }
}
