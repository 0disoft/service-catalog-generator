import { readFile, stat } from "node:fs/promises";
import type { Diagnostic } from "@scg/schema";
import { parseDocument } from "yaml";
import { createDiagnostic } from "./diagnostics.js";
import type { DiscoveredManifest, ParsedManifest } from "./types.js";

export async function parseManifestFile(
  file: DiscoveredManifest,
  maxManifestBytes: number
): Promise<ParsedManifest> {
  const fileStat = await stat(file.realPath);
  if (fileStat.size > maxManifestBytes) {
    return invalidYaml(file, "Manifest file exceeds the configured size limit.");
  }

  let source: string;
  try {
    source = await readFile(file.realPath, "utf8");
  } catch {
    return invalidYaml(file, "Manifest file could not be read.");
  }

  try {
    const document = parseDocument(source, {
      prettyErrors: false,
      schema: "core",
      strict: true,
      uniqueKeys: true,
      merge: false
    });

    if (document.errors.length > 0) {
      return invalidYaml(file, "Manifest YAML is invalid.");
    }

    return {
      ok: true,
      file,
      value: document.toJS({ maxAliasCount: 50 })
    };
  } catch {
    return invalidYaml(file, "Manifest YAML is invalid.");
  }
}

function invalidYaml(file: DiscoveredManifest, message: string): ParsedManifest {
  const diagnostic: Diagnostic = createDiagnostic({
    severity: "error",
    code: "manifest.invalid_yaml",
    file: file.relativePath,
    message,
    hint: "Fix service.yaml syntax and keep manifests below the configured size limit."
  });

  return {
    ok: false,
    file,
    diagnostics: [diagnostic]
  };
}
