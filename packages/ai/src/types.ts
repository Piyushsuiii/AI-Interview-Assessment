import type { z } from "zod";
import type { PromptName, PromptVariables } from "./prompts";

export type ProviderName = "openai" | "gemini";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ProviderResult {
  text: string;
  model: string;
  usage?: TokenUsage;
}

export interface ProviderRequest {
  requestId: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AiFactoryConfig {
  fetch: FetchLike;
  providers: {
    openai?: ProviderConfig;
    gemini?: ProviderConfig;
  };
  routing: {
    preferred: ProviderName;
    fallback?: ProviderName;
  };
  defaultTimeoutMs?: number;
}

export interface AiRequest<K extends PromptName, T> {
  prompt: K;
  variables: PromptVariables[K];
  schema: z.ZodType<T>;
  requestId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AiAttemptMetadata {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  success: boolean;
  usage?: TokenUsage;
  errorCode?: string;
}

export interface AiResponseMetadata {
  requestId: string;
  provider: ProviderName;
  model: string;
  prompt: { name: PromptName; version: string };
  latencyMs: number;
  usage?: TokenUsage;
  attempts: AiAttemptMetadata[];
}

export interface AiResponse<T> {
  data: T;
  metadata: AiResponseMetadata;
}
