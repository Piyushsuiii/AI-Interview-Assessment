import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createAiGateway, type AiAttemptMetadata, type ProviderName } from "@ai-hiring-platform/ai";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { preferredProviderFor } from "./ai-routing";

const jobAnalysisSchema = z.object({
  summary: z.string().min(1),
  competencies: z.array(z.object({
    name: z.string().min(1).max(100),
    importance: z.enum(["NICE_TO_HAVE", "REQUIRED", "CRITICAL"]),
    rationale: z.string().min(1),
  })).min(3).max(20),
  interviewPlan: z.array(z.object({
    section: z.string().min(1),
    durationMinutes: z.number().int().min(5).max(90),
    topics: z.array(z.string().min(1)).min(1),
  })).min(1).max(10),
  evaluationCriteria: z.array(z.string().min(1)).min(3).max(20),
});

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async analyzeJob(
    organizationId: string,
    userId: string,
    input: { title: string; description: string },
  ) {
    const openaiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    const geminiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!openaiKey && !geminiKey) {
      throw new ServiceUnavailableException({
        code: "AI_NOT_CONFIGURED",
        message: "No AI provider is configured",
      });
    }

    const requestedPrimary = this.config.get<ProviderName>("AI_PRIMARY_PROVIDER") ?? "openai";
    const available = [openaiKey && "openai", geminiKey && "gemini"].filter(Boolean) as ProviderName[];
    const preferred = available.includes(requestedPrimary) ? requestedPrimary : available[0];
    const fallback = available.find((provider) => provider !== preferred);
    const gateway = createAiGateway({
      fetch,
      providers: {
        openai: openaiKey ? { apiKey: openaiKey, model: this.config.get("OPENAI_MODEL") ?? "gpt-5.6-sol" } : undefined,
        gemini: geminiKey ? { apiKey: geminiKey, model: this.config.get("GEMINI_MODEL") ?? "gemini-3.6-flash" } : undefined,
      },
      routing: { preferred, fallback },
      defaultTimeoutMs: 30_000,
    });

    const result = await gateway.generate({
      prompt: "job.analyzer",
      variables: {
        jobDescription: `${input.title}\n\n${input.description}`,
        criteria: "Identify competencies and produce an evidence-oriented interview plan.",
      },
      schema: jobAnalysisSchema,
      preferredProvider: preferredProviderFor(this.config, "fast"),
    });
    await Promise.all(result.metadata.attempts.map((attempt) =>
      this.recordUsage(organizationId, userId, result.metadata.requestId, attempt),
    ));
    return result;
  }

  private recordUsage(
    organizationId: string,
    userId: string,
    requestId: string,
    attempt: AiAttemptMetadata,
  ) {
    return this.prisma.aiUsageRecord.create({
      data: {
        organizationId,
        userId,
        requestId,
        operation: "job.analyzer",
        provider: attempt.provider,
        model: attempt.model,
        latencyMs: attempt.latencyMs,
        inputTokens: attempt.usage?.inputTokens,
        outputTokens: attempt.usage?.outputTokens,
        totalTokens: attempt.usage?.totalTokens,
        status: attempt.success ? "SUCCEEDED" : "FAILED",
        error: attempt.errorCode,
      },
    });
  }
}
