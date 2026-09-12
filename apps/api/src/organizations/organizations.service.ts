import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertAssignableRole, type OrgRole } from "@ai-hiring-platform/auth";
import type { AcceptInviteInput, InviteMemberInput, UpdateMemberRoleInput, UpdateOrganizationInput } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { createRawToken, hashToken } from "../common/crypto";
import type { AuthUser } from "../common/decorators/current-user.decorator";

type MutationContext = { userId: string; ipAddress?: string; userAgent?: string };

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  industry: true,
  companySize: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  list(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, organization: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
      select: { role: true, organization: { select: organizationSelect } },
    });
  }

  async team(organizationId: string) {
    const [members, invites] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, createdAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.organizationInvite.findMany({
        where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedBy: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);
    return { members, invites };
  }

  async invite(organizationId: string, input: InviteMemberInput, context: MutationContext) {
    const [organization, member, pending] = await Promise.all([
      this.prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { name: true } }),
      this.prisma.organizationMember.findFirst({ where: { organizationId, user: { email: input.email, deletedAt: null } }, select: { id: true } }),
      this.prisma.organizationInvite.findFirst({ where: { organizationId, email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);
    if (!organization) this.notFound();
    if (member || pending) throw new ConflictException({ code: "TEAM_INVITE_UNAVAILABLE", message: "This person is already a member or has a pending invitation" });

    const token = createRawToken();
    const created = await this.prisma.organizationInvite.create({
      data: { organizationId, invitedById: context.userId, email: input.email, role: input.role, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    try {
      await this.mail.sendInvite(input.email, organization.name, token);
    } catch (error) {
      await this.prisma.organizationInvite.deleteMany({ where: { id: created.id, organizationId, acceptedAt: null } });
      throw error;
    }
    await this.audit.record({ action: "organization.member_invited", organizationId, ...context, metadata: { inviteId: created.id, role: input.role } });
    return created;
  }

  async acceptInvite(input: AcceptInviteInput, user: AuthUser, context: MutationContext) {
    const tokenHash = hashToken(input.token);
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { tokenHash },
      select: { id: true, email: true, role: true, organizationId: true, expiresAt: true, acceptedAt: true, organization: { select: { name: true, deletedAt: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date() || invite.organization.deletedAt || invite.email.toLowerCase() !== user.email.toLowerCase()) this.invalidInvite();

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.organizationInvite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) this.invalidInvite();
      await tx.organizationMember.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
        create: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
        update: {},
      });
    });
    await this.audit.record({ action: "organization.invite_accepted", organizationId: invite.organizationId, ...context, metadata: { inviteId: invite.id } });
    return { organizationId: invite.organizationId, organizationName: invite.organization.name };
  }

  async updateMemberRole(organizationId: string, memberId: string, input: UpdateMemberRoleInput, context: MutationContext) {
    const actor = await this.actorRole(organizationId, context.userId);
    this.assertRoleAllowed(actor, input.role);
    const { target, updated } = await this.prisma.$transaction(async (tx) => {
      const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId }, select: { id: true, role: true, userId: true } });
      if (!target) this.memberNotFound();
      if (target.role === "OWNER" && actor !== "OWNER") this.forbidden();
      if (target.role === "OWNER" && input.role !== "OWNER") await this.ensureAnotherOwner(organizationId, tx);
      const updated = await tx.organizationMember.update({ where: { id: target.id }, data: { role: input.role }, select: { id: true, role: true } });
      return { target, updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record({ action: "organization.member_role_changed", organizationId, ...context, metadata: { memberId, previousRole: target.role, role: input.role } });
    return updated;
  }

  async removeMember(organizationId: string, memberId: string, context: MutationContext) {
    const actor = await this.actorRole(organizationId, context.userId);
    const target = await this.prisma.$transaction(async (tx) => {
      const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId }, select: { id: true, role: true, userId: true } });
      if (!target) this.memberNotFound();
      if (target.role === "OWNER" && actor !== "OWNER") this.forbidden();
      if (target.role === "OWNER") await this.ensureAnotherOwner(organizationId, tx);
      await tx.organizationMember.deleteMany({ where: { id: memberId, organizationId } });
      return target;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record({ action: "organization.member_removed", organizationId, ...context, metadata: { memberId, removedUserId: target.userId, role: target.role } });
  }

  async revokeInvite(organizationId: string, inviteId: string, context: MutationContext) {
    const removed = await this.prisma.organizationInvite.deleteMany({ where: { id: inviteId, organizationId, acceptedAt: null } });
    if (removed.count !== 1) this.inviteNotFound();
    await this.audit.record({ action: "organization.invite_revoked", organizationId, ...context, metadata: { inviteId } });
  }

  private async actorRole(organizationId: string, userId: string): Promise<OrgRole> {
    const actor = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { role: true } });
    if (!actor) this.forbidden();
    return actor.role as OrgRole;
  }

  private assertRoleAllowed(actor: OrgRole, role: OrgRole) {
    try { assertAssignableRole(actor, role); } catch { this.forbidden(); }
  }

  private async ensureAnotherOwner(organizationId: string, db: Prisma.TransactionClient) {
    const owners = await db.organizationMember.count({ where: { organizationId, role: "OWNER" } });
    if (owners <= 1) throw new ConflictException({ code: "LAST_OWNER", message: "The organization must retain at least one owner" });
  }

  private forbidden(): never { throw new ForbiddenException({ code: "INSUFFICIENT_PERMISSIONS", message: "You do not have permission to perform this action" }); }
  private memberNotFound(): never { throw new NotFoundException({ code: "MEMBER_NOT_FOUND", message: "Team member not found" }); }
  private inviteNotFound(): never { throw new NotFoundException({ code: "INVITE_NOT_FOUND", message: "Invitation not found" }); }
  private invalidInvite(): never { throw new BadRequestException({ code: "INVALID_INVITE", message: "This invitation is invalid or has expired" }); }

  async get(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, organization: { deletedAt: null } },
      select: { role: true, organization: { select: organizationSelect } },
    });
    if (!membership) this.notFound();
    return membership;
  }

  async update(
    organizationId: string,
    input: UpdateOrganizationInput,
    context: MutationContext,
  ) {
    try {
      const updated = await this.prisma.organization.updateMany({
        where: {
          id: organizationId,
          deletedAt: null,
          members: { some: { userId: context.userId } },
        },
        data: input,
      });
      if (updated.count !== 1) this.notFound();
      const organization = await this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: organizationSelect,
      });
      await this.audit.record({
        action: "organization.updated",
        organizationId,
        ...context,
        metadata: { fields: Object.keys(input) },
      });
      return organization;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "SLUG_IN_USE",
          message: "Organization slug is already in use",
        });
      }
      throw error;
    }
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "ORGANIZATION_NOT_FOUND",
      message: "Organization not found",
    });
  }
}
