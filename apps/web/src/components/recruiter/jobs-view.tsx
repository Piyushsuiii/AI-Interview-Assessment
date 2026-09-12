"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { apiRequest, getErrorMessage, getJobs, type Job } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, MetricCard, PageSkeleton, Table, primaryLink } from "./ui";

function useJobs() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [result, setResult] = useState<{ organizationId: string; jobs: Job[]; error: string }>({ organizationId: "", jobs: [], error: "" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Job[] | { jobs?: Job[]; items?: Job[] }>(`/organizations/${organizationId}/jobs`, {}, organizationId).then((data) => {
      if (active) setResult({ organizationId, jobs: getJobs(data), error: "" });
    }).catch((requestError: unknown) => {
      if (active) setResult({ organizationId, jobs: [], error: getErrorMessage(requestError) });
    });
    return () => { active = false; };
  }, [organizationId, retryKey]);

  const reload = () => setRetryKey((value) => value + 1);
  return {
    jobs: result.organizationId === organizationId ? result.jobs : [],
    loading: Boolean(organizationId) && result.organizationId !== organizationId,
    error: result.organizationId === organizationId ? result.error : "",
    reload,
    organization,
  };
}

function Status({ value }: { value: string }) {
  const style = value === "PUBLISHED" ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-300" : value === "CLOSED" ? "border-[#444] text-[#888]" : "border-amber-800/70 bg-amber-950/20 text-amber-300";
  return <span className={`inline-flex border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${style}`}>{value}</span>;
}

export function JobsView({ dashboard = false }: { dashboard?: boolean }) {
  const { jobs, loading, error, reload, organization } = useJobs();
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!organization) return <EmptyState title="No organization available" description="Your account is not connected to an organization. Ask an administrator to add you before managing jobs." />;

  const published = jobs.filter((job) => job.status === "PUBLISHED").length;
  const drafts = jobs.filter((job) => job.status === "DRAFT").length;
  const recent = dashboard ? jobs.slice(0, 5) : jobs;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">{organization.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{dashboard ? "Hiring overview" : "Job requisitions"}</h1><p className="mt-2 text-sm text-[#8e8a84]">{dashboard ? "A live view derived from your organization’s jobs." : "Create, review, and track roles from one workspace."}</p></div>
        <Link href="/jobs/new" className={primaryLink}><Plus className="mr-2 size-4" /> New job</Link>
      </div>
      {dashboard ? (
        <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Total roles" value={jobs.length} detail="All requisitions" /><MetricCard label="Published" value={published} detail="Currently open" /><MetricCard label="Drafts" value={drafts} detail="Awaiting publication" /></div>
      ) : null}
      {dashboard ? <div className="grid gap-4 lg:grid-cols-2"><div className="border border-[#303030] bg-[#191919] p-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Candidate pipeline</p><p className="mt-8 text-sm text-[#aaa6a0]">Unavailable until the candidates API is connected.</p></div><div className="border border-[#303030] bg-[#191919] p-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Interview intelligence</p><p className="mt-8 text-sm text-[#aaa6a0]">Unavailable until interview analytics are connected.</p></div></div> : null}
      <section aria-labelledby="jobs-heading">
        <div className="mb-4 flex items-center justify-between"><h2 id="jobs-heading" className="text-lg font-semibold">{dashboard ? "Recent jobs" : `${jobs.length} ${jobs.length === 1 ? "role" : "roles"}`}</h2>{dashboard && jobs.length ? <Link href="/jobs" className="flex items-center gap-2 text-xs text-[#aaa6a0] hover:text-white">View all <ArrowRight className="size-3.5" /></Link> : null}</div>
        {!recent.length ? <EmptyState title="No jobs yet" description="Create your first requisition to begin building a structured hiring workflow." action={<Link href="/jobs/new" className={primaryLink}>Create first job</Link>} /> : (
          <div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table><thead><tr className="border-b border-[#303030] font-mono text-[9px] uppercase tracking-[0.16em] text-[#777]"><th className="px-5 py-4 font-normal">Role</th><th className="px-5 py-4 font-normal">Department</th><th className="px-5 py-4 font-normal">Location</th><th className="px-5 py-4 font-normal">Status</th><th className="px-5 py-4 font-normal">Updated</th></tr></thead><tbody>{recent.map((job) => <tr key={job.id} className="border-b border-[#292929] last:border-0 hover:bg-[#1d1d1d]"><td className="px-5 py-4"><Link href={`/jobs/${job.id}`} className="font-medium hover:text-[#ff6a3d]">{job.title}</Link></td><td className="px-5 py-4 text-[#999]">{job.department || "Not specified"}</td><td className="px-5 py-4 text-[#999]">{job.location || "Not specified"}</td><td className="px-5 py-4"><Status value={job.status} /></td><td className="px-5 py-4 text-[#777]">{job.updatedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(job.updatedAt)) : "Unavailable"}</td></tr>)}</tbody></Table></div>
        )}
      </section>
    </div>
  );
}

export { Status };
