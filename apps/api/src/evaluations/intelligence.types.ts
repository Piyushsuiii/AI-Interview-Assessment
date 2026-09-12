import type { ConfigService } from "@nestjs/config";
import {
  createAiGateway,
  type AiAttemptMetadata,
  type ProviderName,
} from "@ai-hiring-platform/ai";
import type { PrismaService } from "../prisma/prisma.service";
import { incrementUsage } from "../billing/entitlements";

export type IntelligenceDelegate = {
  findFirst(args: object): Promise<any>;
  findMany(args: object): Promise<any[]>;
  findUnique(args: object): Promise<any>;
  create(args: object): Promise<any>;
  createMany(args: object): Promise<any>;
  update(args: object): Promise<any>;
  updateMany(args: object): Promise<any>;
  upsert(args: object): Promise<any>;
  deleteMany(args: object): Promise<any>;
  count(args: object): Promise<number>;
};

export type IntelligenceDb = Record<string, IntelligenceDelegate>;

// Remove this adapter after the contracted intelligence models have been generated.
export const intelligenceDb = (client: PrismaService | object) => client as unknown as IntelligenceDb;

export function createIntelligenceGateway(config: ConfigService): ReturnType<typeof createAiGateway> | null {
  const openaiKey = config.get<string>("OPENAI_API_KEY")?.trim();
  const geminiKey = config.get<string>("GEMINI_API_KEY")?.trim();
  if (!openaiKey && !geminiKey) return null;

  const requested = config.get<ProviderName>("AI_PRIMARY_PROVIDER") ?? "openai";
  const available = [openaiKey && "openai", geminiKey && "gemini"].filter(Boolean) as ProviderName[];
  const preferred = available.includes(requested) ? requested : available[0];
  const fallback = available.find((provider) => provider !== preferred);
  return createAiGateway({
    fetch,
    providers: {
      openai: openaiKey ? { apiKey: openaiKey, model: config.get("OPENAI_MODEL") ?? "gpt-4o-mini" } : undefined,
      gemini: geminiKey ? { apiKey: geminiKey, model: config.get("GEMINI_MODEL") ?? "gemini-2.0-flash" } : undefined,
    },
    routing: { preferred, fallback },
    defaultTimeoutMs: 30_000,
  });
}

export async function recordAiUsage(
  prisma: PrismaService,
  organizationId: string,
  operation: string,
  requestId: string,
  attempts: AiAttemptMetadata[],
  userId?: string,
) {
  await prisma.$transaction(async (tx) => {
    await Promise.all(attempts.map((attempt) => tx.aiUsageRecord.create({
      data: {
        organizationId,
        userId,
        requestId,
        operation,
        provider: attempt.provider,
        model: attempt.model,
        latencyMs: attempt.latencyMs,
        inputTokens: attempt.usage?.inputTokens,
        outputTokens: attempt.usage?.outputTokens,
        totalTokens: attempt.usage?.totalTokens,
        status: attempt.success ? "SUCCEEDED" : "FAILED",
        error: attempt.errorCode,
      },
    })));
    const totalTokens = attempts.reduce((total, attempt) => total + (attempt.usage?.totalTokens ?? 0), 0);
    await incrementUsage(tx, organizationId, "AI_TOKENS", BigInt(totalTokens));
  });
}
