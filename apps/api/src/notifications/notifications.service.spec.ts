import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  it("scopes list and count queries to both tenant and user", async () => {
    const notification = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { notification, $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)) };
    const service = new NotificationsService(prisma as never);

    await service.list("org-a", "user-a", 2, 10, true);

    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", userId: "user-a", readAt: null },
      skip: 10,
      take: 10,
    }));
    expect(notification.count).toHaveBeenCalledWith({ where: { organizationId: "org-a", userId: "user-a", readAt: null } });
  });

  it("cannot mark another user's notification as read", async () => {
    const prisma = { notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new NotificationsService(prisma as never);

    await expect(service.markRead("org-a", "user-a", "notification-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification-b", organizationId: "org-a", userId: "user-a" },
    }));
  });
});
