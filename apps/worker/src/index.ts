import { PrismaClient } from "@prisma/client";
import { Worker, type Job } from "bullmq";
import type { CodeExecutionJob, CodeExecutionJobName, CodeExecutionQueueName } from "@ai-hiring-platform/events";
import { processCodeExecution } from "./processor";

// Type-checked literals avoid requiring a TypeScript-source workspace package at runtime.
const CODE_EXECUTION_QUEUE: CodeExecutionQueueName = "code-execution";
const CODE_EXECUTION_JOB: CodeExecutionJobName = "execute";

function redisConnection(urlValue: string) {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient();
const worker = new Worker<CodeExecutionJob>(
  CODE_EXECUTION_QUEUE,
  async (job: Job<CodeExecutionJob>) => {
    if (job.name !== CODE_EXECUTION_JOB) throw new Error(`Unknown job: ${job.name}`);
    await processCodeExecution(prisma as PrismaClient & Record<string, any>, job.data);
  },
  {
    connection: redisConnection(redisUrl),
    concurrency: Math.max(1, Math.min(8, Number(process.env.WORKER_CONCURRENCY ?? 2))),
    lockDuration: 60_000,
  },
);

worker.on("error", (error: Error) => console.error("Code execution worker error", error));
worker.on("failed", (job: Job<CodeExecutionJob> | undefined, error: Error) => console.error("Code execution job failed", { jobId: job?.id, error: error.message }));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; stopping code execution worker`);
  const forceTimer = setTimeout(() => process.exit(1), 30_000);
  forceTimer.unref();
  try {
    await worker.close();
    await prisma.$disconnect();
  } finally {
    clearTimeout(forceTimer);
  }
}

process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
