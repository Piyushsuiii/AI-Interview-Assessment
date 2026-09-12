import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { InterviewListQuery } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { intelligenceDb } from "../evaluations/intelligence.types";

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: InterviewListQuery) {
    const where: Prisma.InterviewWhereInput = {
      organizationId,
      state: query.state,
      assessmentId: query.assessmentId,
      ...(query.search ? { OR: [
        { candidate: { email: { contains: query.search, mode: "insensitive" } } },
        { candidate: { firstName: { contains: query.search, mode: "insensitive" } } },
        { candidate: { lastName: { contains: query.search, mode: "insensitive" } } },
        { assessment: { title: { contains: query.search, mode: "insensitive" } } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true, state: true, score: true, recommendation: true, progress: true,
          createdAt: true, startedAt: true, completedAt: true,
          candidate: { select: { id: true, email: true, firstName: true, lastName: true, job: { select: { id: true, title: true } } } },
          assessment: { select: { id: true, title: true } },
          report: { select: { id: true } },
          evaluation: { select: { status: true, overallScore: true, recommendation: true } },
        },
      }),
      this.prisma.interview.count({ where }),
    ]);
    return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
  }

  async get(organizationId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        assessment: { select: { id: true, title: true } },
        questions: { orderBy: { order: "asc" }, include: { answer: true } },
      },
    });
    if (!interview) throw new NotFoundException({ code: "INTERVIEW_NOT_FOUND", message: "Interview not found" });
    return interview;
  }

  async replay(organizationId: string, interviewId: string) {
    const interview = await this.get(organizationId, interviewId);
    const db = intelligenceDb(this.prisma);
    const [events, integrityMarkers] = await Promise.all([
      db.interviewEvent.findMany({ where: { interviewId, interview: { organizationId } }, orderBy: { sequence: "asc" } }),
      db.integrityEvent.findMany({ where: { interviewId, organizationId }, orderBy: { occurredAt: "asc" } }),
    ]);
    return { interview, questions: interview.questions, events, integrityMarkers };
  }
}
