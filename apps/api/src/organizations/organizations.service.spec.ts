import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsService team operations", () => {
  const context = { userId: "actor" };

  it("hashes invite tokens, sends only the raw token, and audits", async () => {
    const prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue({ name: "Acme" }) },
      organizationMember: { findFirst: jest.fn().mockResolvedValue(null) },
      organizationInvite: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "invite", email: data.email, role: data.role, expiresAt: data.expiresAt, createdAt: new Date() })),
        deleteMany: jest.fn(),
      },
    };
    const audit = { record: jest.fn() }; const mail = { sendInvite: jest.fn() };
    const service = new OrganizationsService(prisma as never, audit as never, mail as never);
    await service.invite("org", { email: "person@example.com", role: "RECRUITER" }, context);
    const storedHash = prisma.organizationInvite.create.mock.calls[0][0].data.tokenHash;
    const rawToken = mail.sendInvite.mock.calls[0][2];
    expect(rawToken).toHaveLength(64); expect(storedHash).not.toBe(rawToken); expect(storedHash).toHaveLength(64);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.member_invited", organizationId: "org" }));
  });

  it("rejects invite acceptance when the signed-in email differs", async () => {
    const prisma = { organizationInvite: { findUnique: jest.fn().mockResolvedValue({ id: "i", email: "invited@example.com", role: "VIEWER", organizationId: "org", expiresAt: new Date(Date.now() + 10000), acceptedAt: null, organization: { name: "Acme", deletedAt: null } }) } };
    const service = new OrganizationsService(prisma as never, {} as never, {} as never);
    await expect(service.acceptInvite({ token: "a".repeat(64) }, { id: "u", email: "other@example.com", sessionId: "s" }, { userId: "u" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("protects the final owner from removal", async () => {
    const organizationMember = { findUnique: jest.fn().mockResolvedValue({ role: "OWNER" }), findFirst: jest.fn().mockResolvedValue({ id: "m", userId: "actor", role: "OWNER" }), count: jest.fn().mockResolvedValue(1), deleteMany: jest.fn() };
    const prisma = { organizationMember, $transaction: jest.fn().mockImplementation((callback) => callback({ organizationMember })) };
    const service = new OrganizationsService(prisma as never, {} as never, {} as never);
    await expect(service.removeMember("org", "m", context)).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not allow an admin to modify an owner", async () => {
    const organizationMember = { findUnique: jest.fn().mockResolvedValue({ role: "ADMIN" }), findFirst: jest.fn().mockResolvedValue({ id: "owner", userId: "u", role: "OWNER" }) };
    const prisma = { organizationMember, $transaction: jest.fn().mockImplementation((callback) => callback({ organizationMember })) };
    const service = new OrganizationsService(prisma as never, {} as never, {} as never);
    await expect(service.removeMember("org", "owner", context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
