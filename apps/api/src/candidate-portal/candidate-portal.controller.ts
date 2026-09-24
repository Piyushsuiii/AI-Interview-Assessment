import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { updateCandidateProfileSchema, type UpdateCandidateProfileInput } from "@ai-hiring-platform/validation";
import { CandidateAuthGuard } from "../candidate-auth/candidate-auth.guard";
import { clearCandidateCookies } from "../candidate-auth/candidate-cookies";
import { CurrentCandidate, type CandidateAuthPrincipal } from "../candidate-auth/current-candidate.decorator";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CandidatePortalService } from "./candidate-portal.service";

@Controller("candidate/portal")
@UseGuards(CandidateAuthGuard)
export class CandidatePortalController {
  constructor(private readonly portal: CandidatePortalService) {}

  @Get("dashboard")
  dashboard(@CurrentCandidate() candidate: CandidateAuthPrincipal) { return this.portal.dashboard(candidate.id); }

  @Get("interviews")
  interviews(@CurrentCandidate() candidate: CandidateAuthPrincipal) { return this.portal.interviews(candidate.id); }

  @Post("interviews/:interviewId/access-link")
  accessLink(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Param("interviewId") interviewId: string) {
    return this.portal.createInterviewAccessLink(candidate.id, interviewId);
  }

  @Get("profile")
  profile(@CurrentCandidate() candidate: CandidateAuthPrincipal) { return this.portal.profile(candidate.id); }

  @Patch("profile")
  updateProfile(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Body(new SchemaPipe(updateCandidateProfileSchema)) input: UpdateCandidateProfileInput) {
    return this.portal.updateProfile(candidate.id, input);
  }

  @Post("applications/:candidateId/resume")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadResume(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Param("candidateId") candidateId: string, @UploadedFile() file: Express.Multer.File) {
    return this.portal.uploadResume(candidate.id, candidateId, file);
  }

  @Get("applications/:candidateId/resume")
  resume(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Param("candidateId") candidateId: string) {
    return this.portal.resumeDownload(candidate.id, candidateId);
  }

  @Delete("applications/:candidateId/resume")
  deleteResume(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Param("candidateId") candidateId: string) {
    return this.portal.deleteResume(candidate.id, candidateId);
  }

  @Get("privacy/export")
  exportData(@CurrentCandidate() candidate: CandidateAuthPrincipal) { return this.portal.exportData(candidate.id); }

  @Get("privacy/requests")
  privacyRequests(@CurrentCandidate() candidate: CandidateAuthPrincipal) { return this.portal.privacyRequests(candidate.id); }

  @Post("privacy/deletion")
  async requestDeletion(@CurrentCandidate() candidate: CandidateAuthPrincipal, @Res({ passthrough: true }) response: Response) {
    const request = await this.portal.requestDeletion(candidate.id);
    clearCandidateCookies(response);
    return request;
  }
}
