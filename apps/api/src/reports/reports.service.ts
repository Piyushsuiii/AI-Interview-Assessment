import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type { CompareCandidatesInput } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { createIntelligenceGateway, intelligenceDb, recordAiUsage } from "../evaluations/intelligence.types";
import { preferredProviderFor } from "../ai/ai-routing";

export const candidateComparisonSchema = z.object({
  roleId: z.string().min(1),
  comparisons: z.array(z.object({
    candidateId: z.string().min(1),
    criterionAssessments: z.array(z.object({
      criterionId: z.string().min(1),
      assessment: z.string().min(1),
      evidenceIds: z.array(z.string().min(1)),
    }).strict()),
    limitations: z.array(z.string()),
  }).strict()).min(1).max(5),
  decisionSupport: z.string().trim().min(1).max(10_000),
  limitations: z.array(z.string()),
}).strict();

export function candidateComparisonVariables(roleId: string, records: any[]) {
  const criteria = [
    { id: "overall-score", name: "Overall score" },
    { id: "recommendation", name: "Recommendation" },
    { id: "competencies", name: "Competencies" },
  ];
  return {
    roleId,
    criteria,
    candidates: records.map((record) => ({
      candidateId: record.candidate?.id ?? record.id,
      evidence: [{
        id: record.reportId ?? record.candidate?.id ?? record.id,
        text: JSON.stringify(record.snapshot ?? record),
      }],
    })),
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async getByInterview(organizationId: string, interviewId: string) {
    const report = await intelligenceDb(this.prisma).report.findFirst({
      where: { interviewId, organizationId, interview: { organizationId } },
      include: { interview: { include: { evaluation: { include: { competencies: { include: { evidence: true } } } } } } },
    });
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "Report not found" });
    return { ...report, evaluation: report.interview.evaluation };
  }

  async compare(organizationId: string, input: CompareCandidatesInput, userId?: string) {
    const db = intelligenceDb(this.prisma);
    const candidates = await db.candidate.findMany({
      where: { organizationId, id: { in: input.candidateIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobId: true,
      },
    });
    const retrieved = new Set(candidates.map((row) => row.id));
    const missing = input.candidateIds.filter((id) => !retrieved.has(id));
    if (missing.length) throw new BadRequestException({ code: "CANDIDATE_NOT_FOUND", message: "One or more candidates were not found in this organization", candidateIds: missing });

    const reports = await db.report.findMany({
      where: {
        organizationId,
        interview: { organizationId, candidateId: { in: input.candidateIds }, evaluation: { status: "COMPLETED" } },
      },
      orderBy: [{ generatedAt: "desc" }, { id: "asc" }],
      include: { interview: { select: { candidateId: true } } },
    });
    const latestReport = new Map<string, any>();
    for (const report of reports) if (!latestReport.has(report.interview.candidateId)) latestReport.set(report.interview.candidateId, report);
    const byId = new Map(candidates.map((row) => [row.id, row]));
    const records = input.candidateIds.map((candidateId) => {
      const candidate = byId.get(candidateId)!;
      const report = latestReport.get(candidateId);
      return {
        candidate: { id: candidate.id, firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email, jobId: candidate.jobId },
        interviewId: report?.interviewId ?? null,
        reportId: report?.id ?? null,
        snapshot: report?.snapshot ?? null,
        reportCreatedAt: report?.generatedAt ?? null,
      };
    });

    let narrative: string | null = null;
    if (input.includeNarrative) {
      const gateway = createIntelligenceGateway(this.config);
      if (gateway) {
        const result = await gateway.generate({
          prompt: "candidate.comparison",
          variables: candidateComparisonVariables(`organization:${organizationId}`, records),
          schema: candidateComparisonSchema,
          preferredProvider: preferredProviderFor(this.config, "reasoning"),
        });
        await recordAiUsage(this.prisma, organizationId, "candidate.comparison", result.metadata.requestId, result.metadata.attempts, userId);
        if (result.data.roleId !== `organization:${organizationId}`) {
          throw new BadRequestException({ code: "UNGROUNDED_CANDIDATE_REFERENCE", message: "AI comparison returned an ungrounded role ID" });
        }
        this.assertGroundedCandidateIds(result.data.comparisons.map((item) => item.candidateId), retrieved);
        const evidenceIds = new Set(records.map((record) => record.reportId ?? record.candidate.id));
        const criterionIds = new Set(["overall-score", "recommendation", "competencies"]);
        if (result.data.comparisons.some((item) => item.criterionAssessments.some((criterion) => !criterionIds.has(criterion.criterionId) || criterion.evidenceIds.some((id) => !evidenceIds.has(id))))) {
          throw new BadRequestException({ code: "UNGROUNDED_EVIDENCE", message: "AI comparison referenced evidence outside the retrieved reports" });
        }
        narrative = result.data.decisionSupport;
      }
    }
    return { records, narrative };
  }

  assertGroundedCandidateIds(referencedIds: string[], retrievedIds: Set<string>) {
    if (referencedIds.some((id) => !retrievedIds.has(id))) {
      throw new BadRequestException({ code: "UNGROUNDED_CANDIDATE_REFERENCE", message: "AI output referenced a candidate outside the retrieved records" });
    }
  }
}
