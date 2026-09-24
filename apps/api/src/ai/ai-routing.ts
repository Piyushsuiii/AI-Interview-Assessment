import type { ConfigService } from "@nestjs/config";
import type { ProviderName } from "@ai-hiring-platform/ai";

export type AiWorkload = "fast" | "reasoning";

export function preferredProviderFor(config: ConfigService, workload: AiWorkload): ProviderName {
  const mode = config.get<"hybrid" | ProviderName>("AI_ROUTING_MODE") ?? "hybrid";
  if (mode !== "hybrid") return mode;
  return workload === "fast" ? "gemini" : "openai";
}
