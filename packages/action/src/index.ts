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

  const summary = extractSummary(stdoutChunks.join(""));
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

function extractSummary(stdout: string): CliSummary {
  try {
    const payload = JSON.parse(stdout) as CliPayload;
    return {
      serviceCount: numberOrZero(payload.summary?.serviceCount),
      errorCount: numberOrZero(payload.summary?.errorCount),
      warningCount: numberOrZero(payload.summary?.warningCount),
      edgeCount: numberOrZero(payload.summary?.edgeCount)
    };
  } catch {
    return {
      serviceCount: 0,
      errorCount: 0,
      warningCount: 0,
      edgeCount: 0
    };
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createGitHubOutputWriter(env: ActionEnv): ActionOutputWriter {
  return (name, value) => {
    if (!env.GITHUB_OUTPUT) {
      return;
    }

    appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}${EOL}`, "utf8");
  };
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
