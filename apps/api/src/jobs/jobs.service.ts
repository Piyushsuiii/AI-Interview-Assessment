import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateJobInput,
  JobListQuery,
  UpdateJobInput,
} from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

type MutationContext = { userId: string; ipAddress?: string; userAgent?: string };

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: JobListQuery) {
    const where: Prisma.JobWhereInput = {
      organizationId,
      archivedAt: null,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { skills: { some: { name: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: { skills: { orderBy: { createdAt: "asc" } } },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.job.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(organizationId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, organizationId },
      include: { skills: { orderBy: { createdAt: "asc" } } },
    });
    if (!job) this.notFound();
    return job;
  }

  async create(organizationId: string, input: CreateJobInput, context: MutationContext) {
    const job = await this.prisma.job.create({
      data: {
        organizationId,
        createdById: context.userId,
        title: input.title,
        description: input.description,
        department: input.department,
        location: input.location,
        employmentType: input.employmentType,
        experienceLevel: input.experienceLevel,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        salaryCurrency: input.salaryCurrency,
        responsibilities: input.responsibilities,
        status: input.status,
        skills: { create: input.skills },
      },
      include: { skills: true },
    });
    await this.audit.record({
      action: "job.created",
      organizationId,
      ...context,
      metadata: { jobId: job.id },
    });
    return job;
  }

  async update(
    organizationId: string,
    jobId: string,
    input: UpdateJobInput,
    context: MutationContext,
  ) {
    const job = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.job.findFirst({
        where: { id: jobId, organizationId },
        select: { id: true },
      });
      if (!existing) this.notFound();

      const { skills, ...fields } = input;
      return tx.job.update({
        where: { id: jobId },
        data: {
          ...fields,
          ...(skills
            ? { skills: { deleteMany: {}, create: skills } }
            : {}),
        },
        include: { skills: true },
      });
    });
    await this.audit.record({
      action: "job.updated",
      organizationId,
      ...context,
      metadata: { jobId, fields: Object.keys(input) },
    });
    return job;
  }

  async close(organizationId: string, jobId: string, context: MutationContext) {
    const updated = await this.prisma.job.updateMany({
      where: { id: jobId, organizationId },
      data: { status: "CLOSED" },
    });
    if (updated.count !== 1) this.notFound();
    const job = await this.get(organizationId, jobId);
    await this.audit.record({
      action: "job.closed",
      organizationId,
      ...context,
      metadata: { jobId },
    });
    return job;
  }

  private notFound(): never {
    throw new NotFoundException({ code: "JOB_NOT_FOUND", message: "Job not found" });
  }
}
