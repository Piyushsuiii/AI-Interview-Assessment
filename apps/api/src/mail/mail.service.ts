import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { logger } from "@ai-hiring-platform/logger";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async send(message: MailMessage) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("MAIL_FROM");
    if (!apiKey || !from) {
      logger.info("email.skipped", { reason: "provider_not_configured", subject: message.subject });
      return { delivered: false };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      logger.error("email.failed", { status: response.status, subject: message.subject });
      throw new Error(`Email provider returned ${response.status}`);
    }
    logger.info("email.sent", { subject: message.subject });
    return { delivered: true };
  }

  async sendEmailVerification(to: string, token: string) {
    const url = `${this.config.get("FRONTEND_URL")}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: "Verify your AI Hiring account",
      text: `Confirm your email by opening this link: ${url}`,
      html: `<p>Confirm your email address to finish setting up your AI Hiring account.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours and can only be used once.</p>`,
    });
  }

  async sendPasswordReset(to: string, token: string) {
    const url = `${this.config.get("FRONTEND_URL")}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: "Reset your AI Hiring password",
      text: `Reset your password: ${url}`,
      html: `<p>We received a request to reset your AI Hiring password.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 30 minutes and can only be used once. Ignore this email if you did not request it.</p>`,
    });
  }

  async sendInvite(to: string, organizationName: string, token: string) {
    const url = `${this.config.get("FRONTEND_URL")}/team/accept?token=${token}`;
    await this.send({
      to,
      subject: `You were invited to ${organizationName}`,
      text: `Join ${organizationName}: ${url}`,
      html: `<p>Join ${organizationName}:</p><p><a href="${url}">${url}</a></p>`,
    });
  }

  async sendCandidateInvitation(to: string, invitationUrl: string) {
    await this.send({
      to,
      subject: "Your interview invitation",
      text: `Start your interview: ${invitationUrl}`,
      html: `<p>Start your interview:</p><p><a href="${invitationUrl}">${invitationUrl}</a></p>`,
    });
  }
}
