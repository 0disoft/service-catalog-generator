export type ExternalConsumerConformanceOptions = {
  packageSpec?: string;
  expectedVersion?: string;
};

export type ExternalConsumerConformanceResult = {
  packageSpec: string;
  version: string;
  output: string;
};

export function runExternalConsumerConformance(
  options?: ExternalConsumerConformanceOptions
): Promise<ExternalConsumerConformanceResult>;
