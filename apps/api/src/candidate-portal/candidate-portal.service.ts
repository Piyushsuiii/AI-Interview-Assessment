import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateCandidateProfileInput } from "@ai-hiring-platform/validation";
import { AuditService } from "../audit/audit.service";
import { createRawToken, hashToken } from "../common/crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  emailVerifiedAt: true,
  privacyConsentAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CandidatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async dashboard(accountId: string) {
    const applications = await this.prisma.candidate.findMany({
      where: { candidateAccountId: accountId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resumeFileName: true,
        organization: { select: { id: true, name: true } },
        job: { select: { id: true, title: true, department: true, location: true, employmentType: true } },
        interviews: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, state: true, startedAt: true, completedAt: true, invitationExpiresAt: true, updatedAt: true },
        },
      },
    });
    const interviews = applications.flatMap((application) => application.interviews);
    return {
      counts: {
        applications: applications.length,
        pendingInterviews: interviews.filter((item) => !["COMPLETED", "CANCELLED", "EXPIRED"].includes(item.state)).length,
        completedInterviews: interviews.filter((item) => item.state === "COMPLETED").length,
      },
      applications,
    };
  }

  async interviews(accountId: string) {
    return this.prisma.interview.findMany({
      where: { candidate: { candidateAccountId: accountId } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        state: true,
        startedAt: true,
        completedAt: true,
        invitationExpiresAt: true,
        updatedAt: true,
        candidate: { select: { id: true, status: true, organization: { select: { name: true } }, job: { select: { title: true, department: true, location: true } } } },
      },
    });
  }

  async createInterviewAccessLink(accountId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { candidateAccountId: accountId } },
      select: { id: true, state: true },
    });
    if (!interview) throw new NotFoundException({ code: "INTERVIEW_NOT_FOUND", message: "Interview not found" });
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(interview.state)) {
      throw new ConflictException({ code: "INTERVIEW_NOT_AVAILABLE", message: "This interview can no longer be opened" });
    }
    const token = createRawToken();
    await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        invitationTokenHash: hashToken(token),
        invitationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ...(interview.state === "CREATED" ? { state: "INVITED" as const } : {}),
      },
    });
    return { url: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/interview/${token}` };
  }

  profile(accountId: string) {
    return this.prisma.candidateAccount.findUnique({ where: { id: accountId }, select: profileSelect });
  }

  updateProfile(accountId: string, input: UpdateCandidateProfileInput) {
    return this.prisma.candidateAccount.update({
      where: { id: accountId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        ...(input.privacyConsent ? { privacyConsentAt: new Date() } : {}),
      },
      select: profileSelect,
    });
  }

  async uploadResume(accountId: string, candidateId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException({ code: "RESUME_REQUIRED", message: "Select a PDF resume" });
    if (file.size > 10 * 1024 * 1024 || file.mimetype !== "application/pdf" || file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      throw new BadRequestException({ code: "INVALID_RESUME", message: "Resume must be a valid PDF up to 10 MB" });
    }
    const candidate = await this.ownedCandidate(accountId, candidateId);
    const key = `organizations/${candidate.organizationId}/candidates/${candidate.id}/resumes/${Date.now()}-${createRawToken(8)}.pdf`;
    await this.storage.putObject(key, file.buffer, "application/pdf");
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: { resumeObjectKey: key, resumeFileName: file.originalname.slice(0, 255), resumeContentType: "application/pdf", resumeSize: file.size, resumeUploadedAt: new Date() },
    });
    if (candidate.resumeObjectKey) await this.storage.deleteObject(candidate.resumeObjectKey).catch(() => undefined);
    await this.audit.record({ action: "candidate.resume_uploaded", organizationId: candidate.organizationId, metadata: { candidateAccountId: accountId, candidateId } });
    return { fileName: file.originalname, sizeBytes: file.size };
  }

  async resumeDownload(accountId: string, candidateId: string) {
    const candidate = await this.ownedCandidate(accountId, candidateId);
    if (!candidate.resumeObjectKey) throw new NotFoundException({ code: "RESUME_NOT_FOUND", message: "Resume not found" });
    return { fileName: candidate.resumeFileName, url: await this.storage.getSignedDownloadUrl(candidate.resumeObjectKey, candidate.resumeFileName ?? "resume.pdf", 300) };
  }

  async deleteResume(accountId: string, candidateId: string) {
    const candidate = await this.ownedCandidate(accountId, candidateId);
    if (!candidate.resumeObjectKey) return { deleted: true };
    await this.storage.deleteObject(candidate.resumeObjectKey);
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: { resumeObjectKey: null, resumeUrl: null, resumeFileName: null, resumeContentType: null, resumeSize: null, resumeUploadedAt: null },
    });
    await this.audit.record({ action: "candidate.resume_deleted", organizationId: candidate.organizationId, metadata: { candidateAccountId: accountId, candidateId } });
    return { deleted: true };
  }

  exportData(accountId: string) {
    return this.prisma.candidateAccount.findUnique({
      where: { id: accountId },
      select: {
        ...profileSelect,
        candidates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            resumeFileName: true,
            resumeSize: true,
            resumeUploadedAt: true,
            createdAt: true,
            updatedAt: true,
            organization: { select: { name: true } },
            job: { select: { title: true, department: true, location: true, employmentType: true } },
            interviews: {
              select: {
                id: true,
                state: true,
                startedAt: true,
                completedAt: true,
                createdAt: true,
                updatedAt: true,
                questions: {
                  select: {
                    type: true,
                    prompt: true,
                    order: true,
                    answer: { select: { text: true, startedAt: true, submittedAt: true, durationMs: true } },
                  },
                },
                codeSubmissions: { select: { language: true, code: true, explanation: true, isFinal: true, submittedAt: true } },
                systemDesignSubmissions: { select: { diagram: true, explanation: true, submittedAt: true } },
              },
            },
          },
        },
        privacyRequests: { select: { id: true, type: true, status: true, requestedAt: true, resolvedAt: true, resolution: true } },
      },
    });
  }

  privacyRequests(accountId: string) {
    return this.prisma.candidatePrivacyRequest.findMany({ where: { candidateAccountId: accountId }, orderBy: { requestedAt: "desc" } });
  }

  async requestDeletion(accountId: string) {
    const existing = await this.prisma.candidatePrivacyRequest.findFirst({
      where: { candidateAccountId: accountId, type: "DELETION", status: { in: ["REQUESTED", "IN_REVIEW"] } },
    });
    if (existing) return existing;
    await this.prisma.candidateSession.updateMany({ where: { candidateAccountId: accountId }, data: { revokedAt: new Date() } });
    const request = await this.prisma.candidatePrivacyRequest.create({ data: { candidateAccountId: accountId, type: "DELETION" } });
    await this.audit.record({ action: "candidate.deletion_requested", metadata: { candidateAccountId: accountId, privacyRequestId: request.id } });
    return request;
  }

  private async ownedCandidate(accountId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, candidateAccountId: accountId },
      select: { id: true, organizationId: true, resumeObjectKey: true, resumeFileName: true },
    });
    if (!candidate) throw new NotFoundException({ code: "APPLICATION_NOT_FOUND", message: "Application not found" });
    return candidate;
  }
}
