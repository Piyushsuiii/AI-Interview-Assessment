import type { NotificationType, Prisma } from "@prisma/client";

type NotificationEvent = {
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
};

export async function notifyOrganization(
  tx: Prisma.TransactionClient,
  organizationId: string,
  event: NotificationEvent,
) {
  const members = await tx.organizationMember.findMany({
    where: { organizationId, user: { deletedAt: null } },
    select: { userId: true },
  });
  if (!members.length) return;

  await tx.notification.createMany({
    data: members.map(({ userId }) => ({ organizationId, userId, ...event })),
    skipDuplicates: true,
  });
}
