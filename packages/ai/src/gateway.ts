import { randomUUID } from "node:crypto";
import { AiError, AiRoutingError, asAiError } from "./errors";
import { extractJson } from "./json";
import { getPrompt, type PromptName } from "./prompts";
import type {
  AiAttemptMetadata,
  AiProvider,
  AiRequest,
  AiResponse,
} from "./types";

export class AiGateway {
  readonly #providers: readonly AiProvider[];
  readonly #defaultTimeoutMs: number;

  constructor(providers: readonly AiProvider[], defaultTimeoutMs = 30_000) {
    this.#providers = [...providers];
    this.#defaultTimeoutMs = defaultTimeoutMs;
  }

  async generate<K extends PromptName, T>(
    request: AiRequest<K, T>,
  ): Promise<AiResponse<T>> {
    const requestId = request.requestId ?? randomUUID();
    const prompt = getPrompt(request.prompt);
    const startedAt = Date.now();
    const attempts: AiAttemptMetadata[] = [];
    const errors: AiError[] = [];

    for (const provider of this.#providers) {
      const attemptStartedAt = Date.now();
      let usage: AiAttemptMetadata["usage"];
      try {
        const result = await provider.generate({
          requestId,
          systemPrompt: prompt.system,
          userPrompt: prompt.render(request.variables),
          timeoutMs: request.timeoutMs ?? this.#defaultTimeoutMs,
          signal: request.signal,
        });
        usage = result.usage;
        const value = extractJson(result.text, { requestId, provider: provider.name });
        const validation = request.schema.safeParse(value);
        if (!validation.success) {
          throw new AiError({
            code: "SCHEMA_VALIDATION_FAILED",
            message: "AI JSON output did not match the requested schema",
            requestId,
            provider: provider.name,
            retryable: true,
            cause: validation.error,
          });
        }
        attempts.push({
          provider: provider.name,
          model: result.model,
          latencyMs: Date.now() - attemptStartedAt,
          success: true,
          usage,
        });
        return {
          data: validation.data,
          metadata: {
            requestId,
            provider: provider.name,
            model: result.model,
            prompt: { name: request.prompt, version: prompt.version },
            latencyMs: Date.now() - startedAt,
            usage,
            attempts,
          },
        };
      } catch (error) {
        const typedError = asAiError(error, requestId, provider.name);
        errors.push(typedError);
        attempts.push({
          provider: provider.name,
          model: provider.model,
          latencyMs: Date.now() - attemptStartedAt,
          success: false,
          usage,
          errorCode: typedError.code,
        });
        if (typedError.code === "ABORTED") throw typedError;
      }
    }

    throw new AiRoutingError(requestId, errors);
  }
}
