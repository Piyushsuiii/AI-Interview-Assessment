import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CopilotQueryInput } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { createIntelligenceGateway, intelligenceDb, recordAiUsage } from "../evaluations/intelligence.types";
import { candidateComparisonSchema, candidateComparisonVariables, ReportsService } from "../reports/reports.service";
import { preferredProviderFor } from "../ai/ai-routing";

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reports: ReportsService,
  ) {}

  async query(organizationId: string, input: CopilotQueryInput, userId?: string) {
    let records: any[];
    if (input.tool === "compare_candidates") {
      const comparison = await this.reports.compare(organizationId, { candidateIds: input.candidateIds, includeNarrative: false }, userId);
      records = comparison.records;
    } else if (input.tool === "explain_score") {
      records = await this.explainScore(organizationId, input.candidateId);
    } else if (input.tool === "review_priority") {
      records = await this.reviewPriority(organizationId, input.jobId, input.limit);
    } else {
      records = await this.listCandidates(organizationId, input.filters);
    }

    let narrative: string | null = null;
    if (input.includeNarrative && records.length) {
      const retrievedIds = new Set(records.map((record) => record.candidate?.id ?? record.id).filter(Boolean));
      const gateway = createIntelligenceGateway(this.config);
      if (gateway) {
        const result = await gateway.generate({
          prompt: "candidate.comparison",
          variables: candidateComparisonVariables(`copilot:${input.tool}:${organizationId}`, records),
          schema: candidateComparisonSchema,
          preferredProvider: preferredProviderFor(this.config, "reasoning"),
        });
        await recordAiUsage(this.prisma, organizationId, `copilot.${input.tool}`, result.metadata.requestId, result.metadata.attempts, userId);
        if (result.data.roleId !== `copilot:${input.tool}:${organizationId}`) {
          throw new BadRequestException({ code: "UNGROUNDED_CANDIDATE_REFERENCE", message: "Copilot returned an ungrounded role ID" });
        }
        this.assertGrounded(result.data.comparisons.map((item) => item.candidateId), retrievedIds);
        const evidenceIds = new Set(records.map((record) => record.reportId ?? record.candidate?.id ?? record.id).filter(Boolean));
        const criterionIds = new Set(["overall-score", "recommendation", "competencies"]);
        if (result.data.comparisons.some((item) => item.criterionAssessments.some((criterion) => !criterionIds.has(criterion.criterionId) || criterion.evidenceIds.some((id) => !evidenceIds.has(id))))) {
          throw new BadRequestException({ code: "UNGROUNDED_EVIDENCE", message: "Copilot referenced evidence it did not retrieve" });
        }
        narrative = result.data.decisionSupport;
      }
    }
    return { tool: input.tool, records, narrative };
  }

  assertGrounded(referencedIds: string[], retrievedIds: Set<string>) {
    if (referencedIds.some((id) => !retrievedIds.has(id))) {
      throw new BadRequestException({ code: "UNGROUNDED_CANDIDATE_REFERENCE", message: "Copilot referenced a candidate it did not retrieve" });
    }
  }

  private listCandidates(organizationId: string, filters: Extract<CopilotQueryInput, { tool: "list_candidates" }>["filters"]) {
    return intelligenceDb(this.prisma).candidate.findMany({
      where: {
        organizationId,
        jobId: filters.jobId,
        status: filters.status,
        ...(filters.minimumScore === undefined ? {} : { interviews: { some: { evaluation: { is: { status: "COMPLETED", overallScore: { gte: filters.minimumScore } } } } } }),
      },
      take: filters.limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true, status: true, jobId: true },
    });
  }

  private async explainScore(organizationId: string, candidateId: string) {
    const candidate = await intelligenceDb(this.prisma).candidate.findFirst({
      where: { id: candidateId, organizationId },
      select: {
        id: true, firstName: true, lastName: true, jobId: true,
        interviews: {
          where: { organizationId, evaluation: { is: { status: "COMPLETED" } } },
          orderBy: { completedAt: "desc" }, take: 1,
          select: { id: true, evaluation: { include: { competencies: { include: { evidence: true } } } } },
        },
      },
    });
    if (!candidate) throw new BadRequestException({ code: "CANDIDATE_NOT_FOUND", message: "Candidate was not found in this organization" });
    return [{ candidate: { id: candidate.id, firstName: candidate.firstName, lastName: candidate.lastName, jobId: candidate.jobId }, interview: candidate.interviews[0] ?? null }];
  }

  private reviewPriority(organizationId: string, jobId: string | undefined, limit: number) {
    return intelligenceDb(this.prisma).candidate.findMany({
      where: { organizationId, jobId, interviews: { some: { evaluation: { is: { status: "COMPLETED" } } } } },
      take: limit,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, email: true, jobId: true,
        interviews: { where: { organizationId, evaluation: { is: { status: "COMPLETED" } } }, orderBy: { completedAt: "desc" }, take: 1, select: { id: true, completedAt: true, evaluation: { select: { overallScore: true, confidence: true, recommendation: true, overrideRecommendation: true } } } },
      },
    });
  }
}
