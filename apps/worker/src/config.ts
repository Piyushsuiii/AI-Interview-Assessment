export type WorkerConfig = {
  redisUrl: string;
  databaseUrl: string;
  concurrency: number;
};

export function parseWorkerConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const redisUrl = requiredUrl(env.REDIS_URL, "REDIS_URL", ["redis:", "rediss:"]);
  const databaseUrl = requiredUrl(env.DATABASE_URL, "DATABASE_URL", ["postgres:", "postgresql:"]);
  const rawConcurrency = env.WORKER_CONCURRENCY ?? "2";
  if (!/^\d+$/.test(rawConcurrency)) throw new Error("WORKER_CONCURRENCY must be an integer between 1 and 8");
  const concurrency = Number(rawConcurrency);
  if (concurrency < 1 || concurrency > 8) throw new Error("WORKER_CONCURRENCY must be an integer between 1 and 8");
  return { redisUrl, databaseUrl, concurrency };
}

function requiredUrl(value: string | undefined, name: string, protocols: string[]) {
  if (!value) throw new Error(`${name} is required`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${name} uses an unsupported protocol`);
  return value;
}
