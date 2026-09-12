import type { ProviderName } from "./types";

export type AiErrorCode =
  | "ABORTED"
  | "CONFIGURATION_ERROR"
  | "INVALID_JSON"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "SCHEMA_VALIDATION_FAILED"
  | "TIMEOUT";

export interface AiErrorOptions {
  code: AiErrorCode;
  message: string;
  requestId?: string;
  provider?: ProviderName;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly requestId?: string;
  readonly provider?: ProviderName;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(options: AiErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AiError";
    this.code = options.code;
    this.requestId = options.requestId;
    this.provider = options.provider;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export class AiRoutingError extends AiError {
  readonly attempts: readonly AiError[];

  constructor(requestId: string, attempts: readonly AiError[]) {
    super({
      code: attempts.at(-1)?.code ?? "PROVIDER_ERROR",
      message: `All configured AI providers failed for request ${requestId}`,
      requestId,
      cause: attempts.at(-1),
    });
    this.name = "AiRoutingError";
    this.attempts = attempts;
  }
}

export function asAiError(
  error: unknown,
  requestId: string,
  provider?: ProviderName,
): AiError {
  if (error instanceof AiError) return error;
  return new AiError({
    code: "PROVIDER_ERROR",
    message: provider
      ? `${provider} request failed for request ${requestId}`
      : `AI request ${requestId} failed`,
    requestId,
    provider,
    retryable: true,
  });
}
