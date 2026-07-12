import { randomUUID } from "node:crypto";
import { mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { CorePackageBoundary } from "@scg/core";
import type { CatalogSnapshot, Diagnostic } from "@scg/schema";

export const packageName = "@scg/report";

export type ReportPackageBoundary = "catalog-json" | "graph-dot" | "static-html";

export type ReportCoreDependency = CorePackageBoundary;

export type ReportFormat = "json" | "dot" | "html";

export type WrittenReportFile = {
  format: ReportFormat;
  path: string;
};

export type WriteCatalogReportsOptions = {
  cwd?: string;
  outputDirectory: string;
  formats: ReportFormat[];
};

export type WriteCatalogReportsResult = {
  files: WrittenReportFile[];
};

export class ReportWriteError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = "ReportWriteError";
    this.diagnostic = diagnostic;
  }
}

export async function writeCatalogReports(
  snapshot: CatalogSnapshot,
  options: WriteCatalogReportsOptions
): Promise<WriteCatalogReportsResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const cwdRealPath = await realpath(cwd);
  validateOutputDirectory(options.outputDirectory);
  const outputDirectory = resolve(cwd, options.outputDirectory);

  if (!isPathInside(cwd, outputDirectory)) {
    throwWriteError(
      options.outputDirectory,
      "Output directory resolves outside the current workspace.",
      "Choose an --out path inside the current workspace."
    );
  }

  const formats = normalizeFormats(options.formats);
  const files: WrittenReportFile[] = [];

  try {
    await mkdir(outputDirectory, { recursive: true });
    const outputDirectoryRealPath = await realpath(outputDirectory);
    if (!isPathInside(cwdRealPath, outputDirectoryRealPath)) {
      throwWriteError(
        options.outputDirectory,
        "Output directory resolves outside the current workspace.",
        "Choose an --out path inside the current workspace and avoid symlinked output directories."
      );
    }

    for (const format of formats) {
      const fileName = reportFileName(format);
      const absolutePath = resolve(outputDirectoryRealPath, fileName);
      if (!isPathInside(outputDirectoryRealPath, absolutePath)) {
        throwWriteError(
          fileName,
          "Report file resolves outside the output directory.",
          "Use a safe output format."
        );
      }

      await writeAtomic(absolutePath, renderReport(snapshot, format));
      files.push({
        format,
        path: toPosixPath(relative(cwdRealPath, absolutePath))
      });
    }
  } catch (error) {
    if (error instanceof ReportWriteError) {
      throw error;
    }

    throwWriteError(
      toPosixPath(relative(cwd, outputDirectory)),
      "Report output could not be written.",
      "Check --out permissions and ensure the path is a writable directory."
    );
  }

  return { files };
}

export function renderCatalogJson(snapshot: CatalogSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function renderGraphDot(snapshot: CatalogSnapshot): string {
  const serviceNodeIds = snapshot.services.map((service) => graphNodeKey("service", service.id));
  const referencedNodeIds = snapshot.graph.edges.flatMap((edge) => [
    graphNodeKey("service", edge.source),
    graphNodeKey(edge.type, edge.target)
  ]);
  const nodeIds = [...new Set([...serviceNodeIds, ...referencedNodeIds])].sort((left, right) =>
    left.localeCompare(right)
  );
  const serviceById = new Map(snapshot.services.map((service) => [service.id, service]));
  const lines = [
    "digraph service_catalog {",
    "  rankdir=LR;",
    "  node [shape=box, style=rounded];"
  ];

  for (const nodeId of nodeIds) {
    const [nodeType, rawId] = splitGraphNodeKey(nodeId);
    const service = nodeType === "service" ? serviceById.get(rawId) : undefined;
    const label = service ? service.name : `${nodeType}:${rawId}`;
    lines.push(`  ${dotString(nodeId)} [label=${dotString(label)}];`);
  }

  for (const edge of snapshot.graph.edges) {
    const declaringNode = graphNodeKey("service", edge.source);
    const dependencyNode = graphNodeKey(edge.type, edge.target);
    const [source, target] =
      edge.direction === "inbound"
        ? [dependencyNode, declaringNode]
        : [declaringNode, dependencyNode];
    const label = `${edge.type}/${edge.criticality}/${edge.resolution}`;
    const directionAttribute = edge.direction === "bidirectional" ? ", dir=both" : "";
    lines.push(
      `  ${dotString(source)} -> ${dotString(target)} [label=${dotString(label)}${directionAttribute}];`
    );
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function graphNodeKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function splitGraphNodeKey(key: string): [string, string] {
  const separatorIndex = key.indexOf(":");
  return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
}

export function renderStaticHtml(snapshot: CatalogSnapshot): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Service Catalog</title>",
    "<style>",
    "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:2rem;line-height:1.45;color:#161616;background:#fff}",
    "main{max-width:1120px;margin:0 auto}",
    "h1,h2{margin:0 0 .75rem}",
    "section{margin:1.75rem 0}",
    "table{border-collapse:collapse;width:100%;font-size:.95rem}",
    "th,td{border:1px solid #d8d8d8;padding:.5rem;text-align:left;vertical-align:top}",
    "th{background:#f5f5f5}",
    ".summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.75rem;margin:1rem 0}",
    ".metric{border:1px solid #d8d8d8;padding:.75rem}",
    ".metric strong{display:block;font-size:1.5rem}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>Service Catalog</h1>",
    renderSummaryHtml(snapshot),
    renderServicesHtml(snapshot),
    renderEdgesHtml(snapshot),
    renderDiagnosticsHtml(snapshot),
    "</main>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeDotString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}

function renderReport(snapshot: CatalogSnapshot, format: ReportFormat): string {
  switch (format) {
    case "json":
      return renderCatalogJson(snapshot);
    case "dot":
      return renderGraphDot(snapshot);
    case "html":
      return renderStaticHtml(snapshot);
  }
}

function normalizeFormats(formats: ReportFormat[]): ReportFormat[] {
  if (formats.length === 0) {
    return ["json", "dot", "html"];
  }

  return [...new Set(formats)].sort((left, right) => formatRank(left) - formatRank(right));
}

function formatRank(format: ReportFormat): number {
  return ["json", "dot", "html"].indexOf(format);
}

function reportFileName(format: ReportFormat): string {
  switch (format) {
    case "json":
      return "catalog.json";
    case "dot":
      return "graph.dot";
    case "html":
      return "report.html";
  }
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  const temporaryPath = resolve(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function renderSummaryHtml(snapshot: CatalogSnapshot): string {
  return [
    '<section aria-label="Summary">',
    '<div class="summary">',
    metricHtml("Services", snapshot.summary.serviceCount),
    metricHtml("Edges", snapshot.summary.edgeCount),
    metricHtml("Errors", snapshot.summary.errorCount),
    metricHtml("Warnings", snapshot.summary.warningCount),
    "</div>",
    "</section>"
  ].join("\n");
}

function metricHtml(label: string, value: number): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function renderServicesHtml(snapshot: CatalogSnapshot): string {
  const rows = snapshot.services.map((service) =>
    [
      "<tr>",
      tableCell(service.id),
      tableCell(service.name),
      tableCell(service.lifecycle),
      tableCell(`${service.owner.type}:${service.owner.ref}`),
      tableCell(service.repository.slug ?? service.repository.url ?? service.repository.provider),
      tableCell(service.source.path),
      "</tr>"
    ].join("")
  );

  return tableSectionHtml(
    "Services",
    ["ID", "Name", "Lifecycle", "Owner", "Repository", "Source"],
    rows
  );
}

function renderEdgesHtml(snapshot: CatalogSnapshot): string {
  const rows = snapshot.graph.edges.map((edge) =>
    [
      "<tr>",
      tableCell(edge.source),
      tableCell(edge.target),
      tableCell(edge.type),
      tableCell(edge.criticality),
      tableCell(edge.direction),
      tableCell(edge.resolution),
      "</tr>"
    ].join("")
  );

  return tableSectionHtml(
    "Dependencies",
    ["Source", "Target", "Type", "Criticality", "Direction", "Resolution"],
    rows
  );
}

function renderDiagnosticsHtml(snapshot: CatalogSnapshot): string {
  const rows = snapshot.diagnostics.map((diagnostic) =>
    [
      "<tr>",
      tableCell(diagnostic.severity),
      tableCell(diagnostic.code),
      tableCell(diagnostic.file ?? ""),
      tableCell(diagnostic.field ?? ""),
      tableCell(diagnostic.message),
      tableCell(diagnostic.hint ?? ""),
      "</tr>"
    ].join("")
  );

  return tableSectionHtml(
    "Diagnostics",
    ["Severity", "Code", "File", "Field", "Message", "Hint"],
    rows
  );
}

function tableSectionHtml(title: string, headers: string[], rows: string[]): string {
  return [
    "<section>",
    `<h2>${escapeHtml(title)}</h2>`,
    "<table>",
    "<thead>",
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`,
    "</thead>",
    "<tbody>",
    rows.length > 0 ? rows.join("\n") : `<tr><td colspan="${headers.length}">None</td></tr>`,
    "</tbody>",
    "</table>",
    "</section>"
  ].join("\n");
}

function tableCell(value: string): string {
  return `<td>${escapeHtml(value)}</td>`;
}

function dotString(value: string): string {
  return `"${escapeDotString(value)}"`;
}

function isPathInside(parent: string, child: string): boolean {
  const relation = relative(resolve(parent), resolve(child));
  return (
    relation === "" ||
    (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
  );
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function validateOutputDirectory(path: string): void {
  if (!path || /[\0\r\n]/.test(path)) {
    throwWriteError(
      path,
      "Output directory contains an invalid control character.",
      "Choose a non-empty --out path without NUL or line breaks."
    );
  }
}

function throwWriteError(file: string, message: string, hint: string): never {
  throw new ReportWriteError({
    severity: "error",
    code: "output.write_failed",
    file,
    message,
    hint
  });
}
