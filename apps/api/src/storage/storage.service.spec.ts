import { StorageService } from "./storage.service";

describe("StorageService", () => {
  const configuredValues: Record<string, unknown> = {
    S3_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
    S3_REGION: "ap-south-1",
    S3_ACCESS_KEY: "storage-access-key",
    S3_SECRET_KEY: "storage-secret-key",
    S3_BUCKET_NAME: "candidate-resumes",
    S3_FORCE_PATH_STYLE: true,
  };

  it("enables storage for a complete Supabase S3 configuration", () => {
    const config = { get: jest.fn((key: string) => configuredValues[key]) };

    expect(new StorageService(config as never).isConfigured()).toBe(true);
  });

  it("keeps storage disabled when credentials are absent", () => {
    const config = { get: jest.fn(() => "") };

    expect(new StorageService(config as never).isConfigured()).toBe(false);
  });
});
