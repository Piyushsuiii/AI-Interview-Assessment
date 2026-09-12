import { z } from "zod";

const coordinate = z.number().finite().min(-100_000).max(100_000);
const nodeId = z.string().min(1).max(100);

const diagramNodeSchema = z.object({
  id: nodeId,
  type: z.string().min(1).max(50),
  position: z.object({ x: coordinate, y: coordinate }).strict(),
  data: z.object({
    label: z.string().min(1).max(500),
    description: z.string().max(2_000).optional(),
  }).strict(),
}).strict();

const diagramEdgeSchema = z.object({
  id: nodeId,
  source: nodeId,
  target: nodeId,
  label: z.string().max(300).optional(),
  type: z.string().max(50).optional(),
}).strict();

export const systemDesignSubmissionSchema = z.object({
  diagram: z.object({
    nodes: z.array(diagramNodeSchema).max(200),
    edges: z.array(diagramEdgeSchema).max(400),
    viewport: z.object({ x: coordinate, y: coordinate, zoom: z.number().finite().min(0.05).max(8) }).strict(),
  }).strict().superRefine((diagram, context) => {
    const nodeIds = new Set<string>();
    for (const node of diagram.nodes) {
      if (nodeIds.has(node.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate node id: ${node.id}` });
      nodeIds.add(node.id);
    }
    const edgeIds = new Set<string>();
    for (const edge of diagram.edges) {
      if (edgeIds.has(edge.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate edge id: ${edge.id}` });
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Edge ${edge.id} references an unknown node` });
      edgeIds.add(edge.id);
    }
  }),
  explanation: z.string().max(20_000).optional().default(""),
}).strict().refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 250_000, "Submission exceeds 250000 bytes");

export type SystemDesignInput = z.infer<typeof systemDesignSubmissionSchema>;
