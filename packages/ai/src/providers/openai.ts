import { AiError } from "../errors";
import type {
  AiProvider,
  FetchLike,
  ProviderConfig,
  ProviderRequest,
  ProviderResult,
  TokenUsage,
} from "../types";
import {
  fetchJsonWithTimeout,
  isRecord,
} from "./transport";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  readonly model: string;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;

  constructor(config: ProviderConfig, fetchImplementation: FetchLike) {
    this.model = config.model;
    this.#apiKey = config.apiKey;
    this.#baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.#fetch = fetchImplementation;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const { payload } = await fetchJsonWithTimeout(
      this.#fetch,
      `${this.#baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
          "x-request-id": request.requestId,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      },
      { ...request, provider: this.name },
    );
    const choice = isRecord(payload) && Array.isArray(payload.choices)
      ? payload.choices[0]
      : undefined;
    const message = isRecord(choice) ? choice.message : undefined;
    const text = isRecord(message) ? message.content : undefined;
    if (typeof text !== "string") {
      throw new AiError({
        code: "PROVIDER_ERROR",
        message: "OpenAI response did not contain message content",
        requestId: request.requestId,
        provider: this.name,
        retryable: true,
      });
    }
    const usageValue = isRecord(payload) ? payload.usage : undefined;
    const usage: TokenUsage | undefined = isRecord(usageValue)
      ? {
          inputTokens: numberOrUndefined(usageValue.prompt_tokens),
          outputTokens: numberOrUndefined(usageValue.completion_tokens),
          totalTokens: numberOrUndefined(usageValue.total_tokens),
        }
      : undefined;
    return { text, model: this.model, usage };
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
