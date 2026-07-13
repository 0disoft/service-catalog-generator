import { open } from "node:fs/promises";
import type { Diagnostic } from "@scg/schema";
import { parseDocument } from "yaml";
import { createDiagnostic } from "./diagnostics.js";
import { measureValueStructure } from "./resource-policy.js";
import type { DiscoveredManifest, ParsedManifest } from "./types.js";

export async function parseManifestFile(
  file: DiscoveredManifest,
  limits: { maxManifestBytes: number; maxObjectDepth: number }
): Promise<ParsedManifest> {
  let source: string;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(file.realPath, "r");
    const fileStat = await handle.stat();
    if (fileStat.size > limits.maxManifestBytes) {
      return invalidYaml(file, "Manifest file exceeds the configured size limit.");
    }

    const buffer = Buffer.alloc(limits.maxManifestBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    if (offset > limits.maxManifestBytes) {
      return invalidYaml(file, "Manifest file exceeds the configured size limit.");
    }
    source = buffer.subarray(0, offset).toString("utf8");
  } catch {
    return invalidYaml(file, "Manifest file could not be read.");
  } finally {
    await handle?.close();
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

    const value = document.toJS({ maxAliasCount: 50 });
    const metrics = measureValueStructure(value);
    if (metrics.maxDepth > limits.maxObjectDepth) {
      return resourceLimitExceeded(file, "Manifest object depth exceeds the configured limit.");
    }

    return {
      ok: true,
      file,
      value,
      metrics
    };
  } catch {
    return invalidYaml(file, "Manifest YAML is invalid.");
  }
}

function resourceLimitExceeded(file: DiscoveredManifest, message: string): ParsedManifest {
  return {
    ok: false,
    file,
    diagnostics: [
      createDiagnostic({
        severity: "error",
        code: "resource.limit_exceeded",
        file: file.relativePath,
        message,
        hint: "Reduce manifest nesting or raise the matching limits setting."
      })
    ]
  };
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
