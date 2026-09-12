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

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;

  constructor(config: ProviderConfig, fetchImplementation: FetchLike) {
    this.model = config.model;
    this.#apiKey = config.apiKey;
    this.#baseUrl = (
      config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/$/, "");
    this.#fetch = fetchImplementation;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const { payload } = await fetchJsonWithTimeout(
      this.#fetch,
      `${this.#baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.#apiKey,
          "x-request-id": request.requestId,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
      { ...request, provider: this.name },
    );
    const candidate = isRecord(payload) && Array.isArray(payload.candidates)
      ? payload.candidates[0]
      : undefined;
    const content = isRecord(candidate) ? candidate.content : undefined;
    const parts = isRecord(content) ? content.parts : undefined;
    const firstPart = Array.isArray(parts) ? parts[0] : undefined;
    const text = isRecord(firstPart) ? firstPart.text : undefined;
    if (typeof text !== "string") {
      throw new AiError({
        code: "PROVIDER_ERROR",
        message: "Gemini response did not contain candidate content",
        requestId: request.requestId,
        provider: this.name,
        retryable: true,
      });
    }
    const usageValue = isRecord(payload) ? payload.usageMetadata : undefined;
    const usage: TokenUsage | undefined = isRecord(usageValue)
      ? {
          inputTokens: numberOrUndefined(usageValue.promptTokenCount),
          outputTokens: numberOrUndefined(usageValue.candidatesTokenCount),
          totalTokens: numberOrUndefined(usageValue.totalTokenCount),
        }
      : undefined;
    return { text, model: this.model, usage };
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
