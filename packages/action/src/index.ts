import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { EOL } from "node:os";
import { resolve } from "node:path";
import { runCli, type CliPackageBoundary } from "@scg/cli";

export const packageName = "@scg/action";

export type ActionPackageBoundary = "input-mapping" | "output-mapping" | "cli-exit-propagation";

export type ActionCliDependency = CliPackageBoundary;

export type ActionEnv = Record<string, string | undefined>;

export type ActionOutputWriter = (name: string, value: string) => void;

export type RunActionOptions = {
  env?: ActionEnv;
  cwd?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stderr?: Pick<NodeJS.WriteStream, "write">;
  writeOutput?: ActionOutputWriter;
};

type CliSummary = {
  serviceCount: number;
  errorCount: number;
  warningCount: number;
  edgeCount: number;
};

type CliPayload = {
  summary?: Partial<CliSummary>;
};

type SummaryParseResult =
  | {
      ok: true;
      summary: CliSummary;
    }
  | {
      ok: false;
      reason: string;
    };

export async function runAction(options: RunActionOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? env.GITHUB_WORKSPACE ?? process.cwd();
  const command = parseBooleanInput(env, "report") ? "report" : "check";
  const argv = buildCliArguments(env, command);
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  const exitCode = await runCli({
    argv,
    cwd,
    io: {
      stdout: {
        write: (chunk: string) => {
          stdoutChunks.push(chunk);
          stdout.write(chunk);
          return true;
        }
      },
      stderr: {
        write: (chunk: string) => {
          stderrChunks.push(chunk);
          stderr.write(chunk);
          return true;
        }
      }
    }
  });

  const summaryResult = extractSummary(stdoutChunks.join(""));
  if (!summaryResult.ok) {
    stderr.write(`Action could not parse scg JSON summary: ${summaryResult.reason}\n`);
    return exitCode === 0 ? 5 : exitCode;
  }

  const summary = summaryResult.summary;
  const output = options.writeOutput ?? createGitHubOutputWriter(env);
  output("service-count", String(summary.serviceCount));
  output("error-count", String(summary.errorCount));
  output("warning-count", String(summary.warningCount));
  output(
    "report-directory",
    command === "report" ? getInput(env, "output-directory", ".catalog") : ""
  );

  return exitCode;
}

export function buildCliArguments(env: ActionEnv, command: "check" | "report"): string[] {
  const argv = [command, "--json"];

  for (const root of splitListInput(getInput(env, "roots", "."))) {
    argv.push("--root", root);
  }

  const manifestName = getInput(env, "manifest-name", "service.yaml");
  if (manifestName) {
    argv.push("--manifest", manifestName);
  }

  const inputSchema = getInput(env, "input-schema", "scg-v1");
  if (inputSchema) {
    argv.push("--input-schema", inputSchema);
  }

  const config = getInput(env, "config", "");
  if (config) {
    argv.push("--config", config);
  }

  if (parseBooleanInput(env, "fail-on-warning")) {
    argv.push("--fail-on-warning");
  }

  if (parseBooleanInput(env, "allow-unknown-dependencies")) {
    argv.push("--allow-unknown-dependencies");
  }

  if (command === "report") {
    argv.push("--out", getInput(env, "output-directory", ".catalog"));
    for (const format of splitListInput(getInput(env, "format", "json,dot,html"))) {
      argv.push("--format", format);
    }
  }

  return argv;
}

export function getInput(env: ActionEnv, name: string, defaultValue = ""): string {
  const primary = `INPUT_${name.replaceAll(" ", "_").toUpperCase()}`;
  const normalized = `INPUT_${name.replaceAll("-", "_").replaceAll(" ", "_").toUpperCase()}`;
  return (env[primary] ?? env[normalized] ?? defaultValue).trim();
}

export function splitListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBooleanInput(env: ActionEnv, name: string): boolean {
  return getInput(env, name, "false").toLowerCase() === "true";
}

function extractSummary(stdout: string): SummaryParseResult {
  if (!stdout.trim()) {
    return {
      ok: false,
      reason: "stdout was empty"
    };
  }

  let payload: CliPayload;
  try {
    payload = JSON.parse(stdout) as CliPayload;
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "stdout was not valid JSON"
    };
  }

  const summary = payload.summary;
  if (!summary) {
    return {
      ok: false,
      reason: "summary field was missing"
    };
  }

  const serviceCount = readSummaryNumber(summary.serviceCount, "serviceCount");
  const errorCount = readSummaryNumber(summary.errorCount, "errorCount");
  const warningCount = readSummaryNumber(summary.warningCount, "warningCount");
  const edgeCount = readSummaryNumber(summary.edgeCount, "edgeCount");

  if (!serviceCount.ok || !errorCount.ok || !warningCount.ok || !edgeCount.ok) {
    const invalidFields = [serviceCount, errorCount, warningCount, edgeCount].filter(
      (result): result is { ok: false; reason: string } => !result.ok
    );

    return {
      ok: false,
      reason: invalidFields.map((result) => result.reason).join("; ")
    };
  }

  return {
    ok: true,
    summary: {
      serviceCount: serviceCount.value,
      errorCount: errorCount.value,
      warningCount: warningCount.value,
      edgeCount: edgeCount.value
    }
  };
}

function readSummaryNumber(
  value: unknown,
  field: keyof CliSummary
): { ok: true; value: number } | { ok: false; reason: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { ok: true, value };
  }

  return {
    ok: false,
    reason: `summary.${field} was missing or not finite`
  };
}

function createGitHubOutputWriter(env: ActionEnv): ActionOutputWriter {
  return (name, value) => {
    if (!env.GITHUB_OUTPUT) {
      return;
    }

    appendGitHubOutput(env.GITHUB_OUTPUT, name, value);
  };
}

export function appendGitHubOutput(path: string, name: string, value: string): void {
  let delimiter: string;
  do {
    delimiter = `scg_${randomUUID()}`;
  } while (value.includes(delimiter));

  appendFileSync(path, `${name}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`, "utf8");
}

if (process.argv[1] && isActionEntrypoint(process.argv[1])) {
  runAction()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(error instanceof Error ? `${error.message}\n` : "Action failed.\n");
      process.exitCode = 5;
    });
}

function isActionEntrypoint(path: string): boolean {
  const normalized = resolve(path).replaceAll("\\", "/");
  return (
    normalized.endsWith("/dist/action/index.cjs") ||
    normalized.endsWith("/packages/action/dist/index.cjs") ||
    normalized.endsWith("/packages/action/src/index.ts")
  );
}
