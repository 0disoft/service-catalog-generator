const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_VALUE_PATTERN =
  /(?:sk_(?:live|test)_[a-z0-9_]{12,}|gh[pousr]_[a-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/gi;

export function redactOwnerRef(value: string): string {
  return value.replace(EMAIL_PATTERN, "[redacted-email]");
}

export function redactSecretLikeValue(value: string): string {
  return value.replace(SECRET_VALUE_PATTERN, "[redacted-secret]");
}

export function stripAnsiAndControl(value: string): string {
  return stripControlCharacters(stripAnsiSequences(value));
}

function stripAnsiSequences(value: string): string {
  const escape = String.fromCharCode(27);
  const ansiSequence = new RegExp(`${escape}\\[[0-9;]*m`, "g");
  return value.replace(ansiSequence, "");
}

function stripControlCharacters(value: string): string {
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined &&
        (codePoint === 9 ||
          codePoint === 10 ||
          codePoint === 13 ||
          (codePoint >= 32 && codePoint !== 127))
      );
    })
    .join("");
}
