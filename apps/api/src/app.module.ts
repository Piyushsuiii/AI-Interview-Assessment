import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { JobsModule } from "./jobs/jobs.module";
import { CandidatesModule } from "./candidates/candidates.module";
import { AssessmentsModule } from "./assessments/assessments.module";
import { AiModule } from "./ai/ai.module";
import { InterviewsModule } from "./interviews/interviews.module";
import { EvaluationsModule } from "./evaluations/evaluations.module";
import { ReportsModule } from "./reports/reports.module";
import { CopilotModule } from "./copilot/copilot.module";
import { CodingModule } from "./coding/coding.module";
import { SystemDesignModule } from "./system-design/system-design.module";
import { IntegrityModule } from "./integrity/integrity.module";
import { AuditModule } from "./audit/audit.module";
import { MailModule } from "./mail/mail.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { BillingModule } from "./billing/billing.module";
import { HealthController } from "./health.controller";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { envSchema } from "./common/env";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: (config) => {
        if (process.env.NODE_ENV === "test") {
          return envSchema.parse({
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            JWT_ACCESS_SECRET: "test-access-secret-key-32-chars-min",
            JWT_REFRESH_SECRET: "test-refresh-secret-key-32-chars-min",
            FRONTEND_URL: "http://localhost:3000",
            API_URL: "http://localhost:4000",
            ...config,
          });
        }
        return envSchema.parse(config);
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    StorageModule,
    AuditModule,
    MailModule,
    AuthModule,
    OrganizationsModule,
    JobsModule,
    CandidatesModule,
    AssessmentsModule,
    AiModule,
    InterviewsModule,
    AnalyticsModule,
    EvaluationsModule,
    ReportsModule,
    CopilotModule,
    CodingModule,
    SystemDesignModule,
    IntegrityModule,
    NotificationsModule,
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
