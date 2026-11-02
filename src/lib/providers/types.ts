export type SupportedProvider = 'tripo' | 'rodin' | 'meshy' | 'mock';

export interface GenerationTaskOptions {
  jobId: string;
  imageUrl: string;
  tier: 'standard' | 'premium';
  webhookUrl: string;
}

export interface GenerationTaskResult {
  providerTaskId: string;
  provider: SupportedProvider;
  meta?: Record<string, unknown>;
}

export interface ProviderClient {
  readonly name: SupportedProvider;
  submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult>;
  checkBalance?(): Promise<{ credits: number; currency?: string }>;
}
