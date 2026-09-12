import { AiError } from "./errors";
import type { ProviderName } from "./types";

function parse(candidate: string): unknown | undefined {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return undefined;
  }
}

function balancedJsonAt(text: string, start: number): string | undefined {
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.pop() !== expected) return undefined;
      if (stack.length === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

export function extractJson(
  text: string,
  context?: { requestId?: string; provider?: ProviderName },
): unknown {
  const trimmed = text.trim();
  const direct = parse(trimmed);
  if (direct !== undefined) return direct;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fenced)) {
    const parsed = parse(match[1]?.trim() ?? "");
    if (parsed !== undefined) return parsed;
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== "{" && trimmed[index] !== "[") continue;
    const candidate = balancedJsonAt(trimmed, index);
    if (!candidate) continue;
    const parsed = parse(candidate);
    if (parsed !== undefined) return parsed;
  }

  throw new AiError({
    code: "INVALID_JSON",
    message: "The AI provider did not return valid JSON",
    requestId: context?.requestId,
    provider: context?.provider,
    retryable: true,
  });
}
