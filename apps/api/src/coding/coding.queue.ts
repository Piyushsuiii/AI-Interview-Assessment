import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { CODE_EXECUTION_QUEUE as QUEUE_NAME, type CodeExecutionJob } from "@ai-hiring-platform/events";

export const CODE_EXECUTION_QUEUE = Symbol("CODE_EXECUTION_QUEUE");

export function createCodeExecutionQueue(config: ConfigService): Queue<CodeExecutionJob> {
  const redisUrl = new URL(config.get<string>("REDIS_URL") ?? "redis://localhost:6379");
  return new Queue<CodeExecutionJob>(QUEUE_NAME, {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : undefined,
      ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 },
    },
  });
}
