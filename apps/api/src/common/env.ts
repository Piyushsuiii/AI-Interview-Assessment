import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().optional().default(""),
  COOKIE_DOMAIN: z.string().optional(),
  RESEND_API_KEY: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-sol"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  AI_PRIMARY_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  AI_ROUTING_MODE: z.enum(["hybrid", "openai", "gemini"]).default("hybrid"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  S3_ENDPOINT: z.union([z.literal(""), z.string().url()]).default(""),
  S3_REGION: z.string().optional().default(""),
  S3_ACCESS_KEY: z.string().optional().default(""),
  S3_SECRET_KEY: z.string().optional().default(""),
  S3_BUCKET_NAME: z.string().optional().default(""),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_STARTER: z.string().optional().default(""),
  STRIPE_PRICE_GROWTH: z.string().optional().default(""),
  STRIPE_PRICE_ENTERPRISE: z.string().optional().default(""),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && (!env.RESEND_API_KEY || !env.MAIL_FROM)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RESEND_API_KEY and MAIL_FROM are required in production",
      path: ["RESEND_API_KEY"],
    });
  }
  const stripeValues = [env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET, env.STRIPE_PRICE_STARTER, env.STRIPE_PRICE_GROWTH, env.STRIPE_PRICE_ENTERPRISE];
  if (stripeValues.some(Boolean) && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured together",
      path: ["STRIPE_SECRET_KEY"],
    });
  }
  const storageValues = [env.S3_ENDPOINT, env.S3_REGION, env.S3_ACCESS_KEY, env.S3_SECRET_KEY, env.S3_BUCKET_NAME];
  if (storageValues.some(Boolean) && storageValues.some((value) => !value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "All S3 storage settings must be configured together",
      path: ["S3_ENDPOINT"],
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;
