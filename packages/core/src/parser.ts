import { open } from "node:fs/promises";
import type { Diagnostic } from "@scg/schema";
import { parseDocument } from "yaml";
import { createDiagnostic } from "./diagnostics.js";
import { measureValueStructure } from "./resource-policy.js";
import type { DiscoveredManifest, ParsedManifest } from "./types.js";

const MANIFEST_READ_CHUNK_BYTES = 64 * 1024;

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

    const boundedSource = await readBoundedSource(handle, limits.maxManifestBytes);
    if (boundedSource === undefined) {
      return invalidYaml(file, "Manifest file exceeds the configured size limit.");
    }
    source = boundedSource;
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

async function readBoundedSource(
  handle: Awaited<ReturnType<typeof open>>,
  maxBytes: number
): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset <= maxBytes) {
    const remainingBytes = maxBytes + 1 - offset;
    const chunk = Buffer.allocUnsafe(Math.min(MANIFEST_READ_CHUNK_BYTES, remainingBytes));
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
    if (bytesRead === 0) {
      return Buffer.concat(chunks, offset).toString("utf8");
    }

    chunks.push(chunk.subarray(0, bytesRead));
    offset += bytesRead;
  }

  return undefined;
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
