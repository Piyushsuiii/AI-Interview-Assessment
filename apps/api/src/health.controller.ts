import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Queue } from "bullmq";
import type { CodeExecutionJob } from "@ai-hiring-platform/events";
import { PrismaService } from "./prisma/prisma.service";
import { CODE_EXECUTION_QUEUE } from "./coding/coding.queue";
import { StorageService } from "./storage/storage.service";

@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
    };
    const tasks = [
      this.withTimeout(this.prisma.$queryRawUnsafe("SELECT 1")).then(() => { checks.database = "ok"; }),
      this.withTimeout(this.queue.waitUntilReady()).then(() => { checks.redis = "ok"; }),
      ...(this.storage.isConfigured() ? [this.withTimeout(this.storage.checkHealth()).then(() => { checks.storage = "ok"; })] : []),
    ];
    await Promise.allSettled(tasks);
    if (checks.database === "failed" || checks.redis === "failed" || checks.storage === "failed") {
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
