"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiRequest, getCollection, getErrorMessage, type Candidate } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, PageSkeleton, Table, primaryLink } from "./ui";

export function CandidatesView() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [state, setState] = useState<{ key: string; items: Candidate[]; error: string }>({ key: "", items: [], error: "" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Candidate[] | { items?: Candidate[]; candidates?: Candidate[] }>(`/organizations/${organizationId}/candidates`, {}, organizationId)
      .then((data) => active && setState({ key: organizationId, items: getCollection(data), error: "" }))
      .catch((error: unknown) => active && setState({ key: organizationId, items: [], error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [organizationId, retry]);

  if (!organization) return <EmptyState title="No organization available" description="Select an organization before managing candidates." />;
  if (state.key !== organizationId) return <PageSkeleton />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">{organization.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Candidate pipeline</h1><p className="mt-2 text-sm text-[#8e8a84]">People attached to your organization&apos;s active hiring work.</p></div><Link href="/candidates/new" className={primaryLink}><Plus className="mr-2 size-4" /> Add candidate</Link></header>
    {!state.items.length ? <EmptyState title="No candidates yet" description="Add a candidate to a real job before sending an assessment invitation." action={<Link href="/candidates/new" className={primaryLink}>Add first candidate</Link>} /> : <div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table><thead><tr className="border-b border-[#303030] font-mono text-[9px] uppercase tracking-[0.16em] text-[#777]"><th className="px-5 py-4 font-normal">Candidate</th><th className="px-5 py-4 font-normal">Email</th><th className="px-5 py-4 font-normal">Job</th><th className="px-5 py-4 font-normal">Added</th></tr></thead><tbody>{state.items.map((candidate) => <tr key={candidate.id} className="border-b border-[#292929] last:border-0 hover:bg-[#1d1d1d]"><td className="px-5 py-4"><Link href={`/candidates/${candidate.id}`} className="font-medium hover:text-[#ff6a3d]">{[candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Name not provided"}</Link></td><td className="px-5 py-4 text-[#aaa6a0]">{candidate.email}</td><td className="px-5 py-4 text-[#999]">{candidate.job?.title || "Job unavailable"}</td><td className="px-5 py-4 text-[#777]">{candidate.createdAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(candidate.createdAt)) : "Unavailable"}</td></tr>)}</tbody></Table></div>}
  </div>;
}
