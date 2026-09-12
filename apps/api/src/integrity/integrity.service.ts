import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { hashToken } from "../common/crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { IntegritySignalInput } from "./integrity.schemas";
import { notifyOrganization } from "../notifications/notification-events";

const ACTIVE_STATES = ["STARTED", "INTRODUCTION", "TECHNICAL", "FOLLOW_UP", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL"];
const RISK_WEIGHTS: Record<IntegritySignalInput["type"], number> = {
  TAB_SWITCH: 2,
  PASTE: 3,
  INACTIVITY: 1,
  FACE_ABSENT: 2,
  MULTIPLE_FACES: 4,
};

@Injectable()
export class IntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(token: string, input: IntegritySignalInput) {
    const interview = await this.activeInterview(token);
    if (input.clientTimestamp.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException({ code: "INVALID_CLIENT_TIMESTAMP", message: "Client timestamp is too far in the future" });
    }
    const event = await this.prisma.$transaction(async (tx) => {
      const integrityEvent = await (tx as any).integrityEvent.create({
        data: {
          interviewId: interview.id,
          organizationId: interview.organizationId,
          type: input.type,
          occurredAt: input.clientTimestamp,
          details: input.details,
          riskScore: Math.min(RISK_WEIGHTS[input.type], 10),
        },
        select: { id: true, createdAt: true },
      });
      const session = await (tx as any).interviewSession.update({
        where: { interviewId: interview.id },
        data: { lastEventSequence: { increment: 1 } },
        select: { lastEventSequence: true },
      });
      await (tx as any).interviewEvent.create({
        data: {
          interviewId: interview.id,
          sequence: session.lastEventSequence,
          type: "INTEGRITY_SIGNAL",
          occurredAt: input.clientTimestamp,
          payload: { integrityEventId: integrityEvent.id, signalType: input.type },
        },
      });
      if (RISK_WEIGHTS[input.type] >= 3) await notifyOrganization(tx, interview.organizationId, {
        type: "INTEGRITY_ALERT",
        title: "Integrity signal requires review",
        message: `${input.type.replaceAll("_", " ").toLowerCase()} was detected during an interview.`,
        href: `/interviews/${interview.id}`,
        dedupeKey: `integrity-alert:${integrityEvent.id}`,
        metadata: { interviewId: interview.id, integrityEventId: integrityEvent.id, signalType: input.type },
      });
      return integrityEvent;
    });
    return { accepted: true, signalId: event.id, receivedAt: event.createdAt };
  }

  async summary(organizationId: string, interviewId: string) {
    await this.tenantInterview(organizationId, interviewId);
    const events = await (this.prisma as any).integrityEvent.findMany({
      where: { interviewId },
      select: { type: true, riskScore: true, occurredAt: true, createdAt: true },
      orderBy: { occurredAt: "asc" },
    });
    const counts: Record<string, number> = {};
    let rawRisk = 0;
    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      rawRisk += Math.max(0, Math.min(Number(event.riskScore), 10));
    }
    return {
      interviewId,
      signalCount: events.length,
      signalsByType: counts,
      riskScore: Math.min(rawRisk, 100),
      firstSignalAt: events[0]?.occurredAt ?? null,
      lastSignalAt: events.at(-1)?.occurredAt ?? null,
      disclaimer: "Integrity signals require human review and are not findings of misconduct.",
    };
  }

  async events(organizationId: string, interviewId: string) {
    await this.tenantInterview(organizationId, interviewId);
    return (this.prisma as any).integrityEvent.findMany({
      where: { interviewId },
      select: { id: true, type: true, occurredAt: true, details: true, riskScore: true, createdAt: true },
      orderBy: { occurredAt: "desc" },
      take: 500,
    });
  }

  private async tenantInterview(organizationId: string, interviewId: string) {
    const interview = await (this.prisma as any).interview.findFirst({ where: { id: interviewId, organizationId }, select: { id: true } });
    if (!interview) throw new NotFoundException({ code: "INTERVIEW_NOT_FOUND", message: "Interview not found" });
    return interview;
  }

  private async activeInterview(token: string) {
    const interview = await (this.prisma as any).interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      select: { id: true, organizationId: true, state: true, invitationExpiresAt: true },
    });
    if (!interview) throw new NotFoundException({ code: "INVITATION_NOT_FOUND", message: "Invitation not found" });
    if (!interview.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now()) throw new GoneException({ code: "INVITATION_EXPIRED", message: "Invitation has expired" });
    if (!ACTIVE_STATES.includes(interview.state)) throw new ConflictException({ code: "INTERVIEW_NOT_ACTIVE", message: "The interview is not active" });
    return interview;
  }
}
