#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compileCatalog,
  resolveCatalogConfig,
  type CatalogConfigInput,
  type CorePackageBoundary,
  type InputSchema
} from "@scg/core";
import {
  ReportWriteError,
  writeCatalogReports,
  type ReportFormat,
  type WrittenReportFile
} from "@scg/report";
import { parseDocument } from "yaml";

export const packageName = "@scg/cli";
export const cliVersion = "0.5.9";

export type CliPackageBoundary =
  "commands" | "flags" | "config-precedence" | "human-output" | "json-output" | "exit-codes";

export type CliCoreDependency = CorePackageBoundary;

export type CliExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

export type RunCliOptions = {
  argv?: string[];
  cwd?: string;
  io?: CliIo;
};

type CliCommand = "scan" | "check" | "report";

type ParsedArgs = {
  command: CliCommand;
  json: boolean;
  help: boolean;
  version: boolean;
  configPath?: string;
  roots: string[];
  manifestNames: string[];
  formats: ReportFormat[];
  out?: string;
  failOnWarnings: boolean;
  allowUnknownDependencies: boolean;
  inputSchema: InputSchema;
};

type CliDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  file?: string;
  field?: string;
  message: string;
  hint?: string;
};

const DEFAULT_CONFIG_FILE = "scg.config.yaml";

export async function runCli(options: RunCliOptions = {}): Promise<CliExitCode> {
  const argv = options.argv ?? process.argv.slice(2);
  const cwd = resolve(options.cwd ?? process.cwd());
  const io = options.io ?? {
    stdout: process.stdout,
    stderr: process.stderr
  };

  try {
    const parsed = parseArgs(argv);
    if (parsed.version) {
      writeLine(io.stdout, cliVersion);
      return 0;
    }

    if (parsed.help) {
      writeLine(io.stdout, helpText());
      return 0;
    }

    const configResult = await loadConfigInput(cwd, parsed.configPath);
    if (!configResult.ok) {
      return writeCliError(io, parsed.json, configResult.diagnostic);
    }

    const config = mergeCliFlags(configResult.config, parsed);
    const configDiagnosticResult = validateConfigInput(config, parsed.configPath);
    if (configDiagnosticResult) {
      return writeCliError(io, parsed.json, configDiagnosticResult);
    }

    const result = await compileCatalog({
      cwd,
      config,
      toolVersion: cliVersion,
      inputSchema: parsed.inputSchema
    });
    const exitCode = exitCodeForDiagnostics(
      result.snapshot.diagnostics,
      result.config.validation.failOnWarnings
    );

    if (parsed.command === "report") {
      const writeResult = await writeCatalogReports(result.snapshot, {
        cwd,
        outputDirectory: result.config.output.directory,
        formats: result.config.output.formats
      });
      if (parsed.json) {
        writeLine(
          io.stdout,
          JSON.stringify(
            {
              summary: result.snapshot.summary,
              files: writeResult.files,
              diagnostics: result.snapshot.diagnostics
            },
            null,
            2
          )
        );
      } else {
        writeLine(io.stdout, humanSummary(parsed.command, result.snapshot.summary));
        writeWrittenFiles(io.stdout, writeResult.files);
        writeDiagnostics(io.stdout, result.snapshot.diagnostics);
      }
      return exitCode;
    }

    if (parsed.json) {
      writeLine(io.stdout, JSON.stringify(result.snapshot, null, 2));
    } else {
      writeLine(io.stdout, humanSummary(parsed.command, result.snapshot.summary));
      writeDiagnostics(io.stdout, result.snapshot.diagnostics);
    }

    return exitCode;
  } catch (error) {
    if (error instanceof CliUsageError) {
      return writeCliError(io, argv.includes("--json"), {
        severity: "error",
        code: "config.invalid",
        message: error.message,
        hint: "Run scg --help for supported commands and flags."
      });
    }

    if (error instanceof ReportWriteError) {
      return writeCliError(io, argv.includes("--json"), error.diagnostic, 4);
    }

    return writeCliError(
      io,
      argv.includes("--json"),
      {
        severity: "error",
        code: "config.invalid",
        message: "Unexpected CLI failure.",
        hint: error instanceof Error ? error.message : "Rerun with valid arguments."
      },
      5
    );
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const state: ParsedArgs = {
    command: "scan",
    json: false,
    help: false,
    version: false,
    roots: [],
    manifestNames: [],
    formats: [],
    failOnWarnings: false,
    allowUnknownDependencies: false,
    inputSchema: "scg-v1"
  };

  const remaining = [...argv];
  const first = remaining[0];
  if (first === "scan" || first === "check" || first === "report") {
    state.command = first;
    remaining.shift();
  }

  while (remaining.length > 0) {
    const token = remaining.shift();
    if (!token) {
      continue;
    }

    switch (token) {
      case "--help":
      case "-h":
        state.help = true;
        break;
      case "--version":
      case "-v":
        state.version = true;
        break;
      case "--json":
        state.json = true;
        break;
      case "--no-color":
        break;
      case "--fail-on-warning":
        state.failOnWarnings = true;
        break;
      case "--allow-unknown-dependencies":
        state.allowUnknownDependencies = true;
        break;
      case "--input-schema":
        state.inputSchema = parseInputSchema(readFlagValue(token, remaining));
        break;
      case "--root":
        state.roots.push(readFlagValue(token, remaining));
        break;
      case "--config":
        state.configPath = readFlagValue(token, remaining);
        break;
      case "--manifest":
        state.manifestNames.push(readFlagValue(token, remaining));
        break;
      case "--format":
        state.formats.push(parseReportFormat(readFlagValue(token, remaining)));
        break;
      case "--out":
        state.out = readFlagValue(token, remaining);
        break;
      default:
        throw new CliUsageError(`Unknown argument: ${token}`);
    }
  }

  if (state.command !== "report" && state.formats.some((format) => format !== "json")) {
    throw new CliUsageError("Only JSON output is currently supported for scan and check.");
  }

  return state;
}

function parseReportFormat(value: string): ReportFormat {
  if (value === "json" || value === "dot" || value === "html") {
    return value;
  }

  throw new CliUsageError("Unsupported format. Use json, dot, or html.");
}

function parseInputSchema(value: string): InputSchema {
  if (value === "scg-v1" || value === "zdp-v2") {
    return value;
  }

  throw new CliUsageError("Unsupported input schema. Use scg-v1 or zdp-v2.");
}

function readFlagValue(flag: string, remaining: string[]): string {
  const value = remaining.shift();
  if (!value || value.startsWith("-")) {
    throw new CliUsageError(`Missing value for ${flag}.`);
  }
  return value;
}

async function loadConfigInput(
  cwd: string,
  explicitConfigPath: string | undefined
): Promise<
  | {
      ok: true;
      config: CatalogConfigInput;
    }
  | {
      ok: false;
      diagnostic: CliDiagnostic;
    }
> {
  const configPath = explicitConfigPath
    ? resolve(cwd, explicitConfigPath)
    : resolve(cwd, DEFAULT_CONFIG_FILE);

  if (!existsSync(configPath)) {
    if (explicitConfigPath) {
      return {
        ok: false,
        diagnostic: configDiagnostic(
          explicitConfigPath,
          "Config file does not exist.",
          "Create the config file or remove --config."
        )
      };
    }

    return {
      ok: true,
      config: {}
    };
  }

  try {
    const source = await readFile(configPath, "utf8");
    const document = parseDocument(source, {
      prettyErrors: false,
      schema: "core",
      strict: true,
      uniqueKeys: true,
      merge: false
    });

    if (document.errors.length > 0) {
      return {
        ok: false,
        diagnostic: configDiagnostic(
          explicitConfigPath ?? DEFAULT_CONFIG_FILE,
          "Config YAML is invalid.",
          "Fix scg.config.yaml syntax."
        )
      };
    }

    const config = document.toJS({ maxAliasCount: 50 });
    if (!isPlainRecord(config)) {
      return {
        ok: false,
        diagnostic: configDiagnostic(
          explicitConfigPath ?? DEFAULT_CONFIG_FILE,
          "Config file must contain a YAML mapping.",
          "Use schemaVersion and nested scan, validation, output, and privacy mappings."
        )
      };
    }

    return {
      ok: true,
      config: config as CatalogConfigInput
    };
  } catch {
    return {
      ok: false,
      diagnostic: configDiagnostic(
        explicitConfigPath ?? DEFAULT_CONFIG_FILE,
        "Config file could not be read.",
        "Check the config path and file permissions."
      )
    };
  }
}

function mergeCliFlags(config: CatalogConfigInput, parsed: ParsedArgs): CatalogConfigInput {
  return {
    ...config,
    scan: {
      ...config.scan,
      ...(parsed.roots.length > 0 ? { roots: parsed.roots } : {}),
      ...(parsed.manifestNames.length > 0 ? { manifestNames: parsed.manifestNames } : {})
    },
    validation: {
      ...config.validation,
      ...(parsed.failOnWarnings ? { failOnWarnings: true } : {}),
      ...(parsed.allowUnknownDependencies ? { allowUnknownDependencies: true } : {})
    },
    output: {
      ...config.output,
      ...(parsed.out ? { directory: parsed.out } : {}),
      ...(parsed.formats.length > 0 ? { formats: parsed.formats } : {})
    }
  };
}

function validateConfigInput(
  config: CatalogConfigInput,
  explicitConfigPath: string | undefined
): CliDiagnostic | undefined {
  try {
    resolveCatalogConfig(config);
    return undefined;
  } catch {
    return configDiagnostic(
      explicitConfigPath ?? DEFAULT_CONFIG_FILE,
      "Config values do not match the CLI configuration contract.",
      "Use schemaVersion scg.config/v1alpha1 and valid scan, validation, output, and privacy fields."
    );
  }
}

function exitCodeForDiagnostics(
  diagnostics: CliDiagnostic[],
  failOnWarnings: boolean
): CliExitCode {
  if (diagnostics.some((diagnostic) => diagnostic.code === "config.invalid")) {
    return 2;
  }

  if (diagnostics.some((diagnostic) => diagnostic.code === "manifest.invalid_yaml")) {
    return 3;
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return 1;
  }

  if (failOnWarnings && diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return 1;
  }

  return 0;
}

function humanSummary(
  command: CliCommand,
  summary: {
    serviceCount: number;
    errorCount: number;
    warningCount: number;
    edgeCount: number;
  }
): string {
  return [
    `scg ${command}`,
    `services=${summary.serviceCount}`,
    `edges=${summary.edgeCount}`,
    `errors=${summary.errorCount}`,
    `warnings=${summary.warningCount}`
  ].join(" ");
}

function writeDiagnostics(stdout: CliIo["stdout"], diagnostics: CliDiagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const location = [diagnostic.file, diagnostic.field].filter(Boolean).join("#");
    const prefix = location
      ? `${diagnostic.severity} ${diagnostic.code} ${location}`
      : `${diagnostic.severity} ${diagnostic.code}`;
    writeLine(stdout, `${prefix}: ${diagnostic.message}`);
    if (diagnostic.hint) {
      writeLine(stdout, `hint: ${diagnostic.hint}`);
    }
  }
}

function writeWrittenFiles(stdout: CliIo["stdout"], files: WrittenReportFile[]): void {
  for (const file of files) {
    writeLine(stdout, `wrote ${file.format} ${file.path}`);
  }
}

function writeCliError(
  io: CliIo,
  json: boolean,
  diagnostic: CliDiagnostic,
  exitCode: CliExitCode = 2
): CliExitCode {
  const target = exitCode === 0 ? io.stdout : io.stderr;
  if (json) {
    writeLine(target, JSON.stringify({ diagnostics: [diagnostic] }, null, 2));
  } else {
    writeLine(target, `${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.hint) {
      writeLine(target, `hint: ${diagnostic.hint}`);
    }
  }
  return exitCode;
}

function configDiagnostic(file: string, message: string, hint: string): CliDiagnostic {
  return {
    severity: "error",
    code: "config.invalid",
    file,
    message,
    hint
  };
}

function helpText(): string {
  return [
    "Usage: scg <scan|check|report> [flags]",
    "",
    "Commands:",
    "  scan    Print a catalog snapshot",
    "  check   Validate manifests and set the exit code",
    "  report  Write catalog.json, graph.dot, and report.html",
    "",
    "Flags:",
    "  --root <path>",
    "  --config <path>",
    "  --manifest <name>",
    "  --format <json|dot|html>",
    "  --out <path>",
    "  --fail-on-warning",
    "  --allow-unknown-dependencies",
    "  --input-schema <scg-v1|zdp-v2>",
    "  --json",
    "  --no-color"
  ].join("\n");
}

function writeLine(output: Pick<NodeJS.WriteStream, "write">, value: string): void {
  output.write(`${value}\n`);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class CliUsageError extends Error {}

if (process.argv[1] && isCliEntrypoint(process.argv[1])) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      process.exitCode = 5;
    });
}

export function isCliEntrypoint(path: string): boolean {
  const normalized = normalizeCliPath(path);
  return (
    normalized.endsWith("/dist/cli/index.js") ||
    normalized.endsWith("/packages/cli/dist/index.js") ||
    normalized.endsWith("/packages/cli/src/index.ts")
  );
}

function normalizeCliPath(path: string): string {
  const resolved = resolve(path);
  try {
    return realpathSync(resolved).replaceAll("\\", "/");
  } catch {
    return resolved.replaceAll("\\", "/");
  }
}
