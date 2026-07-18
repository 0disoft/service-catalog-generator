export interface ConformanceInvocation {
  cwd: string;
  args: string[];
}

export interface ConformanceSummary {
  serviceCount: number;
  errorCount: number;
  warningCount: number;
  edgeCount: number;
}

export interface ConformanceEdge {
  source: string;
  target: string;
  type: string;
  criticality: string;
  direction: string;
  resolution: string;
}

export interface ConformanceCaseResult {
  id: string;
  summary: ConformanceSummary;
  serviceIds: string[];
  diagnosticCodes: string[];
  edges: ConformanceEdge[];
}

export interface ConformanceResult {
  schemaVersion: "scg.consumer-conformance-result/v1";
  toolVersion: string | undefined;
  caseCount: number;
  cases: ConformanceCaseResult[];
}

export function runConsumerConformance(options: {
  root: string;
  manifestPath: string;
  invokeCli: (invocation: ConformanceInvocation) => string | Promise<string>;
  expectedToolVersion?: string;
  verifyReports?: boolean;
}): Promise<ConformanceResult>;

export function selectContractResult(snapshot: unknown): Omit<ConformanceCaseResult, "id">;

export function verifyActionConformance(options: {
  manifestPath: string;
  caseId: string;
  catalogPath: string;
  actionOutputs: {
    serviceCount: string | undefined;
    errorCount: string | undefined;
    warningCount: string | undefined;
  };
}): Promise<ConformanceCaseResult>;
