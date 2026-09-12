"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, getErrorMessage, type InterviewSummary } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, Input, PageSkeleton, Select, Table } from "./ui";

type Queue = { items: InterviewSummary[]; pagination: { page: number; limit: number; total: number; pages: number } };
const states = ["", "INVITED", "STARTED", "INTRODUCTION", "TECHNICAL", "FOLLOW_UP", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "EVALUATION", "COMPLETED", "CANCELLED", "EXPIRED"];
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export function InterviewsView() {
  const { organization } = useRecruiterApp(); const organizationId = organization?.id ?? "";
  const [query, setQuery] = useState({ page: 1, search: "", state: "", sortBy: "createdAt", sortOrder: "desc" });
  const [state, setState] = useState<{ key: string; data: Queue | null; error: string }>({ key: "", data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const requestKey = `${organizationId}:${JSON.stringify(query)}`;
  useEffect(() => {
    if (!organizationId) return; let active = true;
    const params = new URLSearchParams({ page: String(query.page), limit: "20", sortBy: query.sortBy, sortOrder: query.sortOrder });
    if (query.search) params.set("search", query.search); if (query.state) params.set("state", query.state);
    apiRequest<Queue>(`/organizations/${organizationId}/interviews?${params}`, {}, organizationId).then((data) => active && setState({ key: requestKey, data, error: "" })).catch((error) => active && setState({ key: requestKey, data: null, error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [organizationId, query, requestKey, retry]);
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setQuery((value) => ({ ...value, page: 1, search: String(data.get("search") ?? ""), state: String(data.get("state") ?? ""), sortBy: String(data.get("sortBy") ?? "createdAt"), sortOrder: String(data.get("sortOrder") ?? "desc") })); }
  if (!organization) return <EmptyState title="No organization available" description="Select an organization to review interviews." />;
  if (state.key !== requestKey) return <PageSkeleton />; if (state.error || !state.data) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;
  return <div className="space-y-7"><header><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">Organization-wide</p><h1 className="mt-2 text-3xl font-semibold">Interview review queue</h1><p className="mt-2 text-sm text-[#8e8a84]">{state.data.pagination.total} interviews across all jobs and assessments.</p></header>
    <form onSubmit={filter} className="grid gap-3 border border-[#303030] bg-[#171717] p-4 md:grid-cols-[1fr_180px_180px_130px_auto] md:items-end"><Input name="search" label="Candidate or assessment" defaultValue={query.search} /><Select name="state" label="State" defaultValue={query.state}>{states.map((item) => <option key={item} value={item}>{item ? label(item) : "All states"}</option>)}</Select><Select name="sortBy" label="Sort by" defaultValue={query.sortBy}><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="completedAt">Completed</option><option value="score">Score</option><option value="state">State</option></Select><Select name="sortOrder" label="Order" defaultValue={query.sortOrder}><option value="desc">Descending</option><option value="asc">Ascending</option></Select><button className="btn-orange h-11 px-4 text-xs">Apply</button></form>
    {!state.data.items.length ? <EmptyState title="No interviews found" description="No interview records match the selected filters." /> : <div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table className="min-w-[900px]"><thead><tr className="border-b border-[#303030] font-mono text-[9px] uppercase tracking-widest text-[#777]"><th className="p-4">Candidate</th><th className="p-4">Job / assessment</th><th className="p-4">State</th><th className="p-4">Score</th><th className="p-4">Created</th><th className="p-4 text-right">Review</th></tr></thead><tbody>{state.data.items.map((item) => <tr key={item.id} className="border-b border-[#292929] last:border-0"><td className="p-4"><p>{[item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(" ") || "Name not provided"}</p><p className="text-xs text-[#777]">{item.candidate.email}</p></td><td className="p-4"><p>{item.candidate.job.title}</p><p className="text-xs text-[#777]">{item.assessment.title}</p></td><td className="p-4"><span className="border border-[#3a3a3a] px-2 py-1 font-mono text-[10px]">{label(item.state)}</span></td><td className="p-4">{item.evaluation?.overallScore ?? item.score ?? "Not scored"}</td><td className="p-4 text-[#888]">{new Date(item.createdAt).toLocaleDateString()}</td><td className="p-4 text-right"><Link href={`/interviews/${item.id}`} className="text-xs text-[#ff6a3d] hover:underline">Replay</Link>{item.report ? <Link href={`/reports/${item.id}`} className="ml-4 text-xs text-[#ff6a3d] hover:underline">Report</Link> : null}</td></tr>)}</tbody></Table></div>}
    {state.data.pagination.pages > 1 ? <nav className="flex items-center justify-between text-sm"><button disabled={query.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))} className="btn-ghost px-4 py-2 disabled:opacity-40">Previous</button><span className="text-[#888]">Page {query.page} of {state.data.pagination.pages}</span><button disabled={query.page >= state.data.pagination.pages} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))} className="btn-ghost px-4 py-2 disabled:opacity-40">Next</button></nav> : null}
  </div>;
}
