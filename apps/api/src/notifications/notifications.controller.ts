import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

type ListQuery = z.infer<typeof listQuerySchema>;

@Controller("organizations/:orgId/notifications")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
@RequirePermissions("org:read")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Query(new SchemaPipe(listQuerySchema)) query: ListQuery) {
    return this.notifications.list(orgId, user.id, query.page, query.limit, query.unread);
  }

  @Get("unread-count")
  unreadCount(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(orgId, user.id);
  }

  @Patch("read-all")
  markAllRead(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(orgId, user.id);
  }

  @Patch(":notificationId/read")
  markRead(@Param("orgId") orgId: string, @Param("notificationId") notificationId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(orgId, user.id, notificationId);
  }
}
