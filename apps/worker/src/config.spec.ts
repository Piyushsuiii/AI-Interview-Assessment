import { parseWorkerConfig } from "./config";

describe("worker configuration", () => {
  const base = { REDIS_URL: "rediss://default:secret@example.test:6379", DATABASE_URL: "postgresql://user:secret@example.test:5432/database" };

  it("parses valid managed service URLs without exposing credentials", () => {
    expect(parseWorkerConfig({ ...base, WORKER_CONCURRENCY: "4" })).toEqual(expect.objectContaining({ concurrency: 4 }));
  });

  it.each(["0", "9", "2.5", "many"])("rejects invalid concurrency %s", (WORKER_CONCURRENCY) => {
    expect(() => parseWorkerConfig({ ...base, WORKER_CONCURRENCY })).toThrow("WORKER_CONCURRENCY");
  });

  it("rejects an HTTP URL for Redis", () => {
    expect(() => parseWorkerConfig({ ...base, REDIS_URL: "https://example.test" })).toThrow("unsupported protocol");
  });
});
