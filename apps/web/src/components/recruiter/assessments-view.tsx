"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiRequest, getCollection, getErrorMessage, type Assessment } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, PageSkeleton, Table, primaryLink } from "./ui";

export function AssessmentStatus({ status }: { status?: string }) {
  const value = status || "STATUS UNAVAILABLE";
  const live = value === "PUBLISHED" || value === "ACTIVE";
  const style = live ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-300" : status ? "border-amber-800/70 bg-amber-950/20 text-amber-300" : "border-[#444] text-[#888]";
  return <span className={`inline-flex border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${style}`}>{value.replaceAll("_", " ")}</span>;
}

export function AssessmentsView() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [state, setState] = useState<{ key: string; items: Assessment[]; error: string }>({ key: "", items: [], error: "" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Assessment[] | { items?: Assessment[]; assessments?: Assessment[] }>(`/organizations/${organizationId}/assessments`, {}, organizationId)
      .then((data) => active && setState({ key: organizationId, items: getCollection(data), error: "" }))
      .catch((error: unknown) => active && setState({ key: organizationId, items: [], error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [organizationId, retry]);

  if (!organization) return <EmptyState title="No organization available" description="Select an organization before managing assessments." />;
  if (state.key !== organizationId) return <PageSkeleton />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;

  return <div className="space-y-8"><header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">{organization.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Assessment library</h1><p className="mt-2 text-sm text-[#8e8a84]">Structured interview kits with explicit skills and scoring rubrics.</p></div><Link href="/assessments/new" className={primaryLink}><Plus className="mr-2 size-4" /> New assessment</Link></header>{!state.items.length ? <EmptyState title="No assessments yet" description="Build a question set before inviting candidates to an interview." action={<Link href="/assessments/new" className={primaryLink}>Create assessment</Link>} /> : <div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table><thead><tr className="border-b border-[#303030] font-mono text-[9px] uppercase tracking-[0.16em] text-[#777]"><th className="px-5 py-4 font-normal">Assessment</th><th className="px-5 py-4 font-normal">Duration</th><th className="px-5 py-4 font-normal">Questions</th><th className="px-5 py-4 font-normal">Status</th><th className="px-5 py-4 font-normal">Updated</th></tr></thead><tbody>{state.items.map((assessment) => <tr key={assessment.id} className="border-b border-[#292929] last:border-0 hover:bg-[#1d1d1d]"><td className="px-5 py-4"><Link href={`/assessments/${assessment.id}`} className="font-medium hover:text-[#ff6a3d]">{assessment.title}</Link><p className="mt-1 max-w-md truncate text-xs text-[#777]">{assessment.description || "No description"}</p></td><td className="px-5 py-4 text-[#aaa6a0]">{assessment.durationMins} min</td><td className="px-5 py-4 text-[#aaa6a0]">{assessment.questions?.length ?? "Unavailable"}</td><td className="px-5 py-4"><AssessmentStatus status={assessment.status} /></td><td className="px-5 py-4 text-[#777]">{assessment.updatedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(assessment.updatedAt)) : "Unavailable"}</td></tr>)}</tbody></Table></div>}</div>;
}
