import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { logger } from "@ai-hiring-platform/logger";
import { z } from "zod";

const classificationSchema = z.object({
  label: z.string().min(1).max(100),
  confidence: z.number().min(0).max(1),
  predictions: z.array(z.object({
    label: z.string().min(1).max(100),
    confidence: z.number().min(0).max(1),
  })).min(1).max(24),
  chunksAnalyzed: z.number().int().positive(),
  charactersExtracted: z.number().int().nonnegative(),
  usedOcr: z.boolean(),
  model: z.string().min(1).max(255),
});

export type ResumeClassification = z.infer<typeof classificationSchema>;

@Injectable()
export class ResumeIntelligenceService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>("CVERIFY_URL"));
  }

  async checkHealth() {
    const baseUrl = this.config.get<string>("CVERIFY_URL")?.replace(/\/$/, "");
    if (!baseUrl) return;
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`CVerify health check returned ${response.status}`);
    const payload = z.object({ ready: z.literal(true) }).safeParse(await response.json());
    if (!payload.success) throw new Error("CVerify health response is invalid");
  }

  async classify(file: Express.Multer.File): Promise<ResumeClassification | null> {
    const baseUrl = this.config.get<string>("CVERIFY_URL")?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(file.buffer)], { type: "application/pdf" }), file.originalname);
    try {
      const response = await fetch(`${baseUrl}/classify`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(this.config.get<number>("CVERIFY_TIMEOUT_MS") ?? 30_000),
      });
      if (!response.ok) {
        logger.warn("resume.classification_failed", { status: response.status });
        return null;
      }
      const parsed = classificationSchema.safeParse(await response.json());
      if (!parsed.success) {
        logger.warn("resume.classification_invalid_response", { issues: parsed.error.issues.length });
        return null;
      }
      return parsed.data;
    } catch (error) {
      logger.warn("resume.classification_unavailable", { error: error instanceof Error ? error.message : "unknown" });
      return null;
    }
  }
}
