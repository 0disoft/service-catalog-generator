import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const GENERATION_MARKER = ".scg-generation.json";
const REPORT_FILE_NAMES = new Set(["catalog.json", "graph.dot", "report.html"]);

type GenerationMarker = {
  schemaVersion: "scg.report-generation/v1";
  generationId: string;
  files: string[];
};

export type ReportGenerationFile = {
  name: string;
  contents: string;
};

export type ReportGenerationHooks = {
  beforePromote?: () => Promise<void>;
  beforeInstall?: () => Promise<void>;
};

export class ReportGenerationError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = "ReportGenerationError";
    this.hint = hint;
  }
}

export async function publishReportGeneration(options: {
  cwdRealPath: string;
  outputDirectory: string;
  files: ReportGenerationFile[];
  hooks?: ReportGenerationHooks;
}): Promise<string> {
  const outputDirectory = resolve(options.outputDirectory);
  if (!isPathInside(options.cwdRealPath, outputDirectory)) {
    throw new ReportGenerationError(
      "Output directory resolves outside the current workspace.",
      "Choose an --out path inside the current workspace."
    );
  }
  if (outputDirectory === resolve(options.cwdRealPath)) {
    throw new ReportGenerationError(
      "The workspace root cannot be used as the report output directory.",
      "Choose a dedicated generated directory such as .catalog."
    );
  }

  const outputParent = dirname(outputDirectory);
  await mkdir(outputParent, { recursive: true });
  const outputParentRealPath = await realpath(outputParent);
  const canonicalOutputDirectory = resolve(outputParentRealPath, basename(outputDirectory));

  if (!isPathInside(options.cwdRealPath, outputParentRealPath)) {
    throw new ReportGenerationError(
      "Output directory resolves outside the current workspace.",
      "Choose an --out path inside the current workspace and avoid symlinked parent directories."
    );
  }

  validateGenerationFiles(options.files);

  const generationId = randomUUID();
  const lockDirectory = resolve(
    outputParentRealPath,
    `.${basename(canonicalOutputDirectory)}.scg-write-lock`
  );
  const stagingDirectory = resolve(
    outputParentRealPath,
    `.${basename(canonicalOutputDirectory)}.scg-stage-${generationId}`
  );
  const backupDirectory = resolve(
    outputParentRealPath,
    `.${basename(canonicalOutputDirectory)}.scg-backup-${generationId}`
  );
  let ownsLock = false;
  let preserveBackup = false;

  try {
    await acquireLock(lockDirectory, generationId, canonicalOutputDirectory);
    ownsLock = true;
    const outputExists = await validateExistingOutput(canonicalOutputDirectory);
    await writeStagingGeneration(stagingDirectory, generationId, options.files);
    await options.hooks?.beforePromote?.();

    if (!outputExists) {
      await rename(stagingDirectory, canonicalOutputDirectory);
      return canonicalOutputDirectory;
    }

    await rename(canonicalOutputDirectory, backupDirectory);
    try {
      await options.hooks?.beforeInstall?.();
      await rename(stagingDirectory, canonicalOutputDirectory);
    } catch (error) {
      try {
        await rename(backupDirectory, canonicalOutputDirectory);
      } catch {
        preserveBackup = true;
        throw new ReportGenerationError(
          "Report generation promotion failed and the previous generation could not be restored.",
          `Preserve and inspect ${backupDirectory}; do not remove it until the previous reports are recovered.`
        );
      }
      throw error;
    }

    try {
      await rm(backupDirectory, { force: true, recursive: true });
    } catch {
      preserveBackup = true;
      throw new ReportGenerationError(
        "The new report generation was installed, but the previous backup could not be removed.",
        `Inspect and remove ${backupDirectory} after confirming the new reports are complete.`
      );
    }
    return canonicalOutputDirectory;
  } finally {
    await removeBestEffort(stagingDirectory);
    if (!preserveBackup) {
      await removeBestEffort(backupDirectory);
    }
    if (ownsLock) {
      await releaseOwnedLock(lockDirectory, generationId);
    }
  }
}

async function acquireLock(
  lockDirectory: string,
  generationId: string,
  outputDirectory: string
): Promise<void> {
  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      throw new ReportGenerationError(
        "Another report writer owns the output directory lock.",
        `Wait for the writer to finish. If it crashed, inspect and remove ${lockDirectory} before retrying.`
      );
    }
    throw error;
  }

  try {
    await writeFile(
      resolve(lockDirectory, "owner.json"),
      `${JSON.stringify(
        {
          schemaVersion: "scg.report-write-lock/v1",
          generationId,
          pid: process.pid,
          outputDirectory,
          createdAt: new Date().toISOString()
        },
        null,
        2
      )}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  } catch (error) {
    await rm(lockDirectory, { force: true, recursive: true });
    throw error;
  }
}

async function releaseOwnedLock(lockDirectory: string, generationId: string): Promise<void> {
  try {
    const owner = JSON.parse(
      await readFile(resolve(lockDirectory, "owner.json"), "utf8")
    ) as Partial<{ generationId: string }>;
    if (owner.generationId === generationId) {
      await rm(lockDirectory, { force: true, recursive: true });
    }
  } catch {
    // A missing or changed owner record is not ours to remove.
  }
}

async function validateExistingOutput(outputDirectory: string): Promise<boolean> {
  let stats;
  try {
    stats = await lstat(outputDirectory);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new ReportGenerationError(
      "Report output path must be a regular directory owned by the workspace.",
      "Remove the file or symlink and choose a dedicated generated directory."
    );
  }

  const entries = await readdir(outputDirectory);
  const unknownEntries = entries.filter(
    (entry) => entry !== GENERATION_MARKER && !REPORT_FILE_NAMES.has(entry)
  );
  if (unknownEntries.length > 0) {
    throw new ReportGenerationError(
      "Report output directory contains files that are not owned by SCG.",
      `Move these entries before retrying: ${unknownEntries.sort().join(", ")}`
    );
  }

  if (entries.includes(GENERATION_MARKER)) {
    await validateGenerationMarker(outputDirectory, entries);
  }

  return true;
}

async function validateGenerationMarker(outputDirectory: string, entries: string[]): Promise<void> {
  try {
    const marker = JSON.parse(
      await readFile(resolve(outputDirectory, GENERATION_MARKER), "utf8")
    ) as Partial<GenerationMarker>;
    const reportEntries = entries.filter((entry) => REPORT_FILE_NAMES.has(entry)).sort();
    if (
      marker.schemaVersion !== "scg.report-generation/v1" ||
      typeof marker.generationId !== "string" ||
      marker.generationId.length === 0 ||
      !Array.isArray(marker.files) ||
      marker.files.some((file) => typeof file !== "string") ||
      JSON.stringify([...marker.files].sort()) !== JSON.stringify(reportEntries)
    ) {
      throw new Error("invalid generation marker");
    }
  } catch {
    throw new ReportGenerationError(
      "Report output directory has an invalid generation marker.",
      "Preserve the directory for inspection, then regenerate into a clean dedicated output path."
    );
  }
}

async function writeStagingGeneration(
  stagingDirectory: string,
  generationId: string,
  files: ReportGenerationFile[]
): Promise<void> {
  await mkdir(stagingDirectory);
  await Promise.all(
    files.map((file) =>
      writeFile(resolve(stagingDirectory, file.name), file.contents, {
        encoding: "utf8",
        flag: "wx"
      })
    )
  );
  const marker: GenerationMarker = {
    schemaVersion: "scg.report-generation/v1",
    generationId,
    files: files.map((file) => file.name).sort()
  };
  await writeFile(
    resolve(stagingDirectory, GENERATION_MARKER),
    `${JSON.stringify(marker, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
}

function validateGenerationFiles(files: ReportGenerationFile[]): void {
  const names = new Set<string>();
  for (const file of files) {
    if (!REPORT_FILE_NAMES.has(file.name) || names.has(file.name)) {
      throw new ReportGenerationError(
        "Report generation contains an invalid or duplicate file name.",
        "Use each supported report format at most once."
      );
    }
    names.add(file.name);
  }
}

function isPathInside(parent: string, child: string): boolean {
  const relation = relative(resolve(parent), resolve(child));
  return (
    relation === "" ||
    (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
  );
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

async function removeBestEffort(path: string): Promise<void> {
  try {
    await rm(path, { force: true, recursive: true });
  } catch {
    // A cleanup failure must not prevent releasing the generation lock.
  }
}
