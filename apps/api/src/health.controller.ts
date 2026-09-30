import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Queue } from "bullmq";
import type { CodeExecutionJob } from "@ai-hiring-platform/events";
import { PrismaService } from "./prisma/prisma.service";
import { CODE_EXECUTION_QUEUE } from "./coding/coding.queue";
import { StorageService } from "./storage/storage.service";
import { ResumeIntelligenceService } from "./resume-intelligence/resume-intelligence.service";

@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly resumeIntelligence: ResumeIntelligenceService,
    @Inject(CODE_EXECUTION_QUEUE) private readonly queue: Queue<CodeExecutionJob>,
  ) {}

  @Get()
  check() {
    return { status: "ok", service: "api", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async readiness() {
    const checks: Record<string, "ok" | "disabled" | "failed"> = {
      database: "failed",
      redis: "failed",
      storage: this.storage.isConfigured() ? "failed" : "disabled",
      cverify: this.resumeIntelligence.isConfigured() ? "failed" : "disabled",
    };
    const tasks = [
      this.withTimeout(this.prisma.$queryRawUnsafe("SELECT 1")).then(() => { checks.database = "ok"; }),
      this.withTimeout(this.queue.waitUntilReady()).then(() => { checks.redis = "ok"; }),
      ...(this.storage.isConfigured() ? [this.withTimeout(this.storage.checkHealth()).then(() => { checks.storage = "ok"; })] : []),
      ...(this.resumeIntelligence.isConfigured() ? [this.withTimeout(this.resumeIntelligence.checkHealth()).then(() => { checks.cverify = "ok"; })] : []),
    ];
    await Promise.allSettled(tasks);
    if (Object.values(checks).includes("failed")) {
      throw new ServiceUnavailableException({ code: "SERVICE_NOT_READY", message: "One or more required dependencies are unavailable", checks });
    }
    return { status: "ready", checks, timestamp: new Date().toISOString() };
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs = 3_000): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Dependency health check timed out")), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
