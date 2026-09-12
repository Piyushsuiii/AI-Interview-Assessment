import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, userId: string, page: number, limit: number, unread: boolean) {
    const where = { organizationId, userId, ...(unread ? { readAt: null } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async unreadCount(organizationId: string, userId: string) {
    const count = await this.prisma.notification.count({ where: { organizationId, userId, readAt: null } });
    return { count };
  }

  async markRead(organizationId: string, userId: string, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, organizationId, userId },
      data: { readAt: new Date() },
    });
    if (!updated.count) {
      throw new NotFoundException({ code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" });
    }
    return { markedRead: true };
  }

  async markAllRead(organizationId: string, userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { markedRead: updated.count };
  }
}
