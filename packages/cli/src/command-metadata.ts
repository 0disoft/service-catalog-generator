export const cliCommandDefinitions = [
  { name: "scan", description: "Print a catalog snapshot." },
  { name: "check", description: "Validate manifests and set the exit code." },
  { name: "report", description: "Write catalog.json, graph.dot, and report.html." },
  { name: "completion", description: "Print shell completion source." }
] as const;

export const cliFlagDefinitions = [
  { name: "--root", value: "<path>", description: "Add a scan root." },
  { name: "--config", value: "<path>", description: "Load a config file." },
  { name: "--manifest", value: "<name>", description: "Select a manifest filename." },
  {
    name: "--format",
    value: "<format>",
    description: "Select a report format.",
    choices: ["json", "dot", "html"]
  },
  { name: "--out", value: "<path>", description: "Select the report output directory." },
  { name: "--fail-on-warning", description: "Fail when warnings are present." },
  { name: "--no-fail-on-warning", description: "Keep warnings non-failing." },
  {
    name: "--allow-unknown-dependencies",
    description: "Permit unresolved dependency references."
  },
  {
    name: "--no-allow-unknown-dependencies",
    description: "Reject unresolved dependency references."
  },
  {
    name: "--input-schema",
    value: "<schema>",
    description: "Select an input manifest adapter.",
    choices: ["scg-v1", "zdp-v2"]
  },
  { name: "--json", description: "Emit the complete JSON snapshot." },
  { name: "--summary-json", description: "Emit bounded automation JSON." },
  { name: "--no-color", description: "Disable terminal color." },
  { name: "--help", description: "Show CLI help." },
  { name: "--version", description: "Show the CLI version." }
] as const;

export const completionShells = ["bash", "zsh", "powershell"] as const;

export const cliExitCodes = [0, 1, 2, 3, 4, 5] as const;

export type CompletionShell = (typeof completionShells)[number];
export type CliExitCode = (typeof cliExitCodes)[number];
