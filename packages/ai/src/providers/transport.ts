import { AiError } from "../errors";
import type { FetchLike, ProviderName } from "../types";

export async function fetchJsonWithTimeout(
  fetchImplementation: FetchLike,
  url: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    signal?: AbortSignal;
    requestId: string;
    provider: ProviderName;
  },
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetchImplementation(url, {
      ...init,
      signal: controller.signal,
    });
    assertSuccessfulResponse(response, options.provider, options.requestId);
    const payload: unknown = await response.json();
    return { response, payload };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (options.signal?.aborted) {
      throw new AiError({
        code: "ABORTED",
        message: `AI request ${options.requestId} was aborted`,
        requestId: options.requestId,
        provider: options.provider,
      });
    }
    if (controller.signal.aborted) {
      throw new AiError({
        code: "TIMEOUT",
        message: `${options.provider} timed out after ${options.timeoutMs}ms`,
        requestId: options.requestId,
        provider: options.provider,
        retryable: true,
      });
    }
    throw new AiError({
      code: "PROVIDER_ERROR",
      message: `${options.provider} network request failed`,
      requestId: options.requestId,
      provider: options.provider,
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function assertSuccessfulResponse(
  response: Response,
  provider: ProviderName,
  requestId: string,
): void {
  if (response.ok) return;
  const rateLimited = response.status === 429;
  throw new AiError({
    code: rateLimited ? "RATE_LIMITED" : "PROVIDER_ERROR",
    message: `${provider} returned HTTP ${response.status}`,
    requestId,
    provider,
    status: response.status,
    retryable: rateLimited || response.status >= 500,
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
