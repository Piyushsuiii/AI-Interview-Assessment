"use client";

import { useState, type FormEvent } from "react";
import { ArrowUp, Bot, Braces, Database, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useRecruiterApp } from "@/components/recruiter/app-shell";
import { getErrorMessage } from "@/lib/api";
import { displayName, queryCopilot, type CopilotRecord, type CopilotResult, type CopilotToolInput } from "@/lib/intelligence-api";
import { IntelligenceEmpty, IntelligenceError, IntelligenceHeader, StatusPill, label, panel } from "./intelligence-ui";

const examples = [
  "List the 20 most recently updated candidates",
  "Show 10 candidates waiting for review",
  "List candidates with a minimum interview score of 80",
];

export function CopilotView() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const groundedQuery = query.trim();
    if (!organizationId || !groundedQuery) return;
    const toolInput = parseToolInput(groundedQuery);
    if (!toolInput) {
      setError("This question cannot be mapped to an available structured tool. Try a candidate list, minimum-score, or review-priority query.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setSubmittedQuery(groundedQuery);
    try {
      setResult(await queryCopilot(organizationId, toolInput));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  if (!organization) return <IntelligenceEmpty title="No organization available" description="Select an organization before querying hiring records." />;

  return <div className="space-y-8">
    <IntelligenceHeader eyebrow="Grounded recruiter copilot" title="Ask the hiring record" description="Questions run against structured tools scoped to the selected organization. Every response exposes the tool invocation and candidate records returned by the API." action={<div className="grid size-12 place-items-center border border-[#ff4d1c]/50 bg-[#271915]"><Sparkles className="size-5 text-[#ff6b3f]" /></div>} />
    <section className="border border-[#373737] bg-[linear-gradient(135deg,#1d1d1d,#151515)] p-5 md:p-7" aria-labelledby="query-heading"><h2 id="query-heading" className="sr-only">Query copilot</h2><form onSubmit={submit}><label htmlFor="copilot-query" className={label}>Question</label><div className="mt-3 flex items-end gap-2 border border-[#454545] bg-[#111] p-2 focus-within:border-[#ff4d1c] focus-within:ring-2 focus-within:ring-[#ff4d1c]/15"><textarea id="copilot-query" value={query} onChange={(event) => setQuery(event.target.value)} rows={3} required placeholder="Ask about candidates, scores, recommendations, or interview evidence..." className="min-h-20 flex-1 resize-y bg-transparent p-2 text-sm leading-6 outline-none placeholder:text-[#666]" /><button type="submit" disabled={loading || !query.trim()} aria-label="Run grounded query" className="btn-orange grid size-10 shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-50">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}</button></div></form><div className="mt-4 flex flex-wrap gap-2" aria-label="Example prompts">{examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)} className="border border-[#393939] bg-[#1b1b1b] px-3 py-2 text-left text-xs text-[#9e9992] transition hover:border-[#666] hover:text-white">{example}</button>)}</div><p className="mt-4 flex items-center gap-2 text-[11px] text-[#6f6b66]"><Database className="size-3" /> Results are organization-scoped API records, not generated examples.</p></section>
    {error ? <IntelligenceError message={error} /> : null}
    {loading ? <div role="status" className={`${panel} flex min-h-40 items-center justify-center gap-3 text-sm text-[#999]`}><LoaderCircle className="size-4 animate-spin text-[#ff4d1c]" /> Running structured query</div> : null}
    {result && !loading ? <CopilotResponse query={submittedQuery} result={result} /> : !error && !loading ? <IntelligenceEmpty title="No query run yet" description="Enter a question or choose an example prompt. Records appear only after a successful API call." /> : null}
  </div>;
}

function CopilotResponse({ query, result }: { query: string; result: CopilotResult }) {
  return <section className="space-y-5" aria-live="polite" aria-labelledby="response-heading"><div className={`${panel} p-5 md:p-6`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[#ff4d1c] text-white"><Bot className="size-4" /></span><div><p className={label}>Copilot response</p><h2 id="response-heading" className="mt-1 text-sm text-[#d7d2cb]">{query}</h2></div></div><span className="font-mono text-[10px] text-[#777]">{result.records.length} records returned</span></div>{result.answer ? <p className="mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[#d6d1ca]">{result.answer}</p> : <p className="mt-5 text-sm text-[#777]">The API returned records without a narrative response.</p>}</div><div className="grid gap-5 lg:grid-cols-[300px_1fr]"><aside className={`${panel} h-fit p-5`}><div className="flex items-center gap-2"><Braces className="size-4 text-[#ff6b3f]" /><h3 className={label}>Structured tool run</h3></div><div className="mt-4"><StatusPill>{result.tool.name}</StatusPill></div>{result.tool.arguments && Object.keys(result.tool.arguments).length ? <dl className="mt-5 space-y-3">{Object.entries(result.tool.arguments).map(([key, value]) => <div key={key} className="border-t border-[#2f2f2f] pt-3"><dt className="font-mono text-[10px] uppercase tracking-wider text-[#777]">{key}</dt><dd className="mt-1 break-words text-xs leading-5 text-[#b8b3ac]">{formatValue(value)}</dd></div>)}</dl> : <p className="mt-4 text-xs text-[#666]">No tool arguments returned.</p>}</aside><div><div className="flex items-center gap-2"><Search className="size-4 text-[#ff6b3f]" /><h3 className={label}>Returned candidate records</h3></div>{result.records.length ? <div className="mt-4 grid gap-3 xl:grid-cols-2">{result.records.map((record, index) => <RecordCard key={String(record.id ?? record.candidateId ?? index)} record={record} />)}</div> : <div className="mt-4"><IntelligenceEmpty title="No matching records" description="The structured tool completed but did not return candidate records." /></div>}</div></div></section>;
}

function RecordCard({ record }: { record: CopilotRecord }) {
  const entries = Object.entries(record).filter(([key, value]) => value !== undefined && value !== null && !["firstName", "lastName"].includes(key));
  const nestedCandidate = typeof record.candidate === "object" && record.candidate !== null ? record.candidate as CopilotRecord : undefined;
  const person = nestedCandidate ?? record;
  return <article className={`${panel} min-w-0 p-5`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{displayName(person)}</p>{person.email ? <p className="mt-1 truncate text-xs text-[#777]">{person.email}</p> : null}</div><Database className="size-4 shrink-0 text-[#ff6b3f]" /></div><dl className="mt-4 divide-y divide-[#2c2c2c] border-t border-[#2c2c2c]">{entries.map(([key, value]) => <div key={key} className="grid grid-cols-[100px_1fr] gap-3 py-2.5 text-xs"><dt className="break-words font-mono uppercase tracking-wide text-[#716d68]">{humanize(key)}</dt><dd className="min-w-0 break-words text-[#bcb7b0]">{formatValue(value)}</dd></div>)}</dl></article>;
}

function parseToolInput(query: string): CopilotToolInput | null {
  const normalized = query.toLowerCase();
  const limitMatch = normalized.match(/\b(?:list|show)(?: the)?\s+(\d{1,2})\s+candidates?\b/);
  const limit = limitMatch ? Math.max(1, Math.min(50, Number(limitMatch[1]))) : undefined;
  if (normalized.includes("review")) return { tool: "review_priority", limit: Math.min(limit ?? 10, 25), includeNarrative: true };
  if (/\b(list|show|find)\b/.test(normalized) && normalized.includes("candidate")) {
    const scoreMatch = normalized.match(/(?:minimum|min|above|over)(?: interview)? score(?: of)?\s*(\d{1,3})/);
    const minimumScore = scoreMatch ? Math.max(0, Math.min(100, Number(scoreMatch[1]))) : undefined;
    return { tool: "list_candidates", filters: { limit: limit ?? 20, ...(minimumScore === undefined ? {} : { minimumScore }) }, includeNarrative: true };
  }
  return null;
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return "Unserializable value"; }
}
