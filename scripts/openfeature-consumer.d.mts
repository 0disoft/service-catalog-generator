export type OpenFeatureReportFormat = "json" | "dot" | "html";

export interface OpenFeatureConsumerResult {
  schemaVersion: "scg.openfeature-consumer-result/v1";
  providerVersion: string;
  formats: OpenFeatureReportFormat[];
  serviceCount: number;
}

export function selectEnabledReportFormats(
  flagValues: Readonly<Record<string, boolean>>
): OpenFeatureReportFormat[];

export function runOpenFeatureConsumer(options?: {
  root?: string;
}): Promise<OpenFeatureConsumerResult>;
