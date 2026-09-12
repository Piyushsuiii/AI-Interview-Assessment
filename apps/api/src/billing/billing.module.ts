import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { BillingController, StripeWebhookController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeClient } from "./stripe.client";

@Module({
  imports: [AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeClient, OrgContextGuard, PermissionsGuard],
})
export class BillingModule {}
