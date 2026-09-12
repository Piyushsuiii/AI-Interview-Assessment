import { z } from "zod";

export const INTEGRITY_SIGNAL_TYPES = [
  "TAB_SWITCH",
  "PASTE",
  "INACTIVITY",
  "FACE_ABSENT",
  "MULTIPLE_FACES",
] as const;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema).max(50),
  z.record(z.string().max(100), jsonValueSchema),
]));

export const integritySignalSchema = z.object({
  type: z.enum(INTEGRITY_SIGNAL_TYPES),
  clientTimestamp: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  details: z.record(z.string().max(100), jsonValueSchema).optional().default({}),
}).strict().refine((value) => Buffer.byteLength(JSON.stringify(value.details), "utf8") <= 10_000, "Signal details exceed 10000 bytes");

export type IntegritySignalInput = z.infer<typeof integritySignalSchema>;
