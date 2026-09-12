import { z } from "zod";

export const codeRequestSchema = z.object({
  language: z.string().trim().toLowerCase().min(1).max(32),
  sourceCode: z.string().min(1).max(100_000),
  explanation: z.string().trim().max(10_000).optional(),
}).strict();

export type CodeRequest = z.infer<typeof codeRequestSchema>;
