import { BadRequestException, Body, Controller, Get, Headers, Param, Post, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { BillingService } from "./billing.service";

const checkoutSchema = z.object({ plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]) }).strict();

@Controller("organizations/:orgId/billing")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
@RequirePermissions("billing:manage")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  summary(@Param("orgId") orgId: string) { return this.billing.summary(orgId); }

  @Post("checkout")
  checkout(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body(new SchemaPipe(checkoutSchema)) input: z.infer<typeof checkoutSchema>) {
    return this.billing.createCheckout(orgId, user.email, input.plan);
  }

  @Post("portal")
  portal(@Param("orgId") orgId: string) { return this.billing.createPortal(orgId); }
}

@Controller("billing")
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post("webhook")
  webhook(@Req() request: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    if (!request.rawBody || !signature) {
      throw new BadRequestException({ code: "INVALID_STRIPE_WEBHOOK", message: "Raw body and Stripe signature are required" });
    }
    return this.billing.processWebhook(this.billing.constructWebhookEvent(request.rawBody, signature));
  }
}
