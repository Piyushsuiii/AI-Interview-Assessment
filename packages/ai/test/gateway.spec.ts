import { z } from "zod";
import {
  AiError,
  AiRoutingError,
  createAiGateway,
  extractJson,
  type FetchLike,
} from "../index";

const outputSchema = z.object({ title: z.string(), score: z.number() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AI gateway", () => {
  it("uses OpenAI first and returns validated data with metadata", async () => {
    const fetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>()
      .mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: '{"title":"Engineer","score":9}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: { openai: { apiKey: "secret", model: "gpt-test" } },
      routing: { preferred: "openai" },
    });

    const response = await gateway.generate({
      prompt: "job.analyzer",
      variables: { jobDescription: "Build reliable APIs" },
      schema: outputSchema,
      requestId: "request-1",
    });

    expect(response.data).toEqual({ title: "Engineer", score: 9 });
    expect(response.metadata).toMatchObject({
      requestId: "request-1",
      provider: "openai",
      model: "gpt-test",
      prompt: { name: "job.analyzer", version: "1.0.0" },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init?.headers).toMatchObject({ authorization: "Bearer secret" });
  });

  it("waits for a failed preferred provider before invoking fallback", async () => {
    const calls: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const fetchMock: FetchLike = async (url) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push(url.includes("openai") ? "openai" : "gemini");
      await Promise.resolve();
      active -= 1;
      if (url.includes("openai")) return jsonResponse({ error: "unavailable" }, 503);
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"title":"Fallback","score":7}' }] } }],
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 },
      });
    };
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: {
        openai: { apiKey: "openai-secret", model: "gpt-test" },
        gemini: { apiKey: "gemini-secret", model: "gemini-test" },
      },
      routing: { preferred: "openai", fallback: "gemini" },
    });

    const response = await gateway.generate({
      prompt: "recruiter.copilot",
      variables: { context: "Candidate profile", question: "Assess fit" },
      schema: outputSchema,
    });

    expect(calls).toEqual(["openai", "gemini"]);
    expect(maximumActive).toBe(1);
    expect(response.metadata.provider).toBe("gemini");
    expect(response.metadata.attempts.map(({ provider, success }) => ({ provider, success })))
      .toEqual([
        { provider: "openai", success: false },
        { provider: "gemini", success: true },
      ]);
  });

  it("falls back when structured output fails Zod validation", async () => {
    const fetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>()
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: '{"title":"Wrong"}' } }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "```json\n{\"title\":\"Valid\",\"score\":8}\n```" }] } }],
        }),
      );
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: {
        openai: { apiKey: "a", model: "openai-model" },
        gemini: { apiKey: "b", model: "gemini-model" },
      },
      routing: { preferred: "openai", fallback: "gemini" },
    });

    const response = await gateway.generate({
      prompt: "job.analyzer",
      variables: { jobDescription: "Example" },
      schema: outputSchema,
    });

    expect(response.data.score).toBe(8);
    expect(response.metadata.attempts[0]?.errorCode).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("does not fall back after caller cancellation", async () => {
    const fetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>()
      .mockImplementation(async (_url, init) => {
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      });
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: {
        openai: { apiKey: "a", model: "openai-model" },
        gemini: { apiKey: "b", model: "gemini-model" },
      },
      routing: { preferred: "openai", fallback: "gemini" },
    });
    const controller = new AbortController();
    const pending = gateway.generate({
      prompt: "job.analyzer",
      variables: { jobDescription: "Example" },
      schema: outputSchema,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject<Partial<AiError>>({ code: "ABORTED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out a provider and records a typed failure", async () => {
    const fetchMock: FetchLike = async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("timed out")));
      });
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: { openai: { apiKey: "a", model: "openai-model" } },
      routing: { preferred: "openai" },
      defaultTimeoutMs: 1,
    });

    let caught: unknown;
    try {
      await gateway.generate({
        prompt: "job.analyzer",
        variables: { jobDescription: "Example" },
        schema: outputSchema,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AiRoutingError);
    expect((caught as AiRoutingError).attempts[0]?.code).toBe("TIMEOUT");
  });

  it("returns typed routing errors without credential values", async () => {
    const fetchMock: FetchLike = async () => jsonResponse({}, 429);
    const gateway = createAiGateway({
      fetch: fetchMock,
      providers: { openai: { apiKey: "must-not-leak", model: "gpt-test" } },
      routing: { preferred: "openai" },
    });

    let caught: unknown;
    try {
      await gateway.generate({
        prompt: "job.analyzer",
        variables: { jobDescription: "Example" },
        schema: outputSchema,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AiRoutingError);
    expect(String(caught)).not.toContain("must-not-leak");
    expect((caught as AiRoutingError).attempts[0]?.code).toBe("RATE_LIMITED");
  });
});

describe("extractJson", () => {
  it("extracts a balanced JSON object from surrounding text", () => {
    expect(extractJson('Result: {"value":"brace } in string"} done')).toEqual({
      value: "brace } in string",
    });
  });
});
