import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AnalyticsQuery } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string, query: AnalyticsQuery) {
    const to = query.to ? new Date(query.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const createdAt: Prisma.DateTimeFilter | undefined = query.from || to ? { gte: query.from, lte: to } : undefined;
    const interviewWhere: Prisma.InterviewWhereInput = { organizationId, createdAt };
    const candidateWhere: Prisma.CandidateWhereInput = { organizationId, createdAt };

    const [states, candidateStatuses, scored, competencies, durations, assessmentGroups] = await Promise.all([
      this.prisma.interview.groupBy({ by: ["state"], where: interviewWhere, _count: { _all: true } }),
      this.prisma.candidate.groupBy({ by: ["status"], where: candidateWhere, _count: { _all: true } }),
      this.prisma.interview.findMany({ where: { ...interviewWhere, score: { not: null } }, select: { score: true } }),
      this.prisma.competencyEvaluation.groupBy({
        by: ["name"],
        where: { evaluation: { organizationId, createdAt } },
        _avg: { score: true },
        _count: { _all: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.interview.findMany({ where: { ...interviewWhere, startedAt: { not: null } }, select: { state: true, startedAt: true, completedAt: true, updatedAt: true } }),
      this.prisma.interview.groupBy({ by: ["assessmentId"], where: interviewWhere, _count: { _all: true }, _avg: { score: true } }),
    ]);

    const assessmentIds = assessmentGroups.map((item) => item.assessmentId);
    const assessments = assessmentIds.length ? await this.prisma.assessment.findMany({ where: { organizationId, id: { in: assessmentIds } }, select: { id: true, title: true } }) : [];
    const assessmentNames = new Map(assessments.map((item) => [item.id, item.title]));
    const stateCount = new Map(states.map((item) => [item.state, item._count._all]));
    const total = states.reduce((sum, item) => sum + item._count._all, 0);
    const completed = stateCount.get("COMPLETED") ?? 0;
    const started = durations.length;
    const scoreBuckets = [
      { label: "0-19", min: 0, max: 20 }, { label: "20-39", min: 20, max: 40 },
      { label: "40-59", min: 40, max: 60 }, { label: "60-79", min: 60, max: 80 },
      { label: "80-100", min: 80, max: Number.POSITIVE_INFINITY },
    ].map((bucket) => ({ label: bucket.label, count: scored.filter((item) => item.score !== null && item.score >= bucket.min && item.score < bucket.max).length }));
    const completedDurations = durations.filter((item) => item.completedAt).map((item) => (item.completedAt!.getTime() - item.startedAt!.getTime()) / 60_000).filter((value) => value >= 0);

    return {
      range: { from: query.from ?? null, to: query.to ?? null },
      hiringFunnel: { candidates: candidateStatuses.reduce((sum, item) => sum + item._count._all, 0), invited: total, started, completed },
      completion: { total, completed, rate: total ? completed / total : 0 },
      scoreDistribution: scoreBuckets,
      competencyDistribution: competencies.map((item) => ({ name: item.name, averageScore: item._avg.score ?? 0, count: item._count._all })),
      duration: { averageMinutes: completedDurations.length ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length : null, completedSamples: completedDurations.length },
      dropOff: states.filter((item) => item.state !== "COMPLETED").map((item) => ({ state: item.state, count: item._count._all })),
      candidateStatuses: candidateStatuses.map((item) => ({ status: item.status, count: item._count._all })),
      assessmentPerformance: assessmentGroups.map((item) => ({ assessmentId: item.assessmentId, title: assessmentNames.get(item.assessmentId) ?? "Deleted assessment", interviews: item._count._all, averageScore: item._avg.score })),
    };
  }
}
