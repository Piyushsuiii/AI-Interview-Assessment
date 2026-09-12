"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { apiRequest, getErrorMessage, type Job } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, PageSkeleton } from "./ui";
import { Status } from "./jobs-view";

export function JobDetail({ id }: { id: string }) {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const requestId = `${organizationId}:${id}`;
  const [result, setResult] = useState<{ requestId: string; job: Job | null; error: string }>({ requestId: "", job: null, error: "" });
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Job>(`/organizations/${organizationId}/jobs/${encodeURIComponent(id)}`, {}, organizationId).then((job) => {
      if (active) setResult({ requestId, job, error: "" });
    }).catch((requestError: unknown) => {
      if (active) setResult({ requestId, job: null, error: getErrorMessage(requestError) });
    });
    return () => { active = false; };
  }, [id, organizationId, requestId, retryKey]);
  const loading = Boolean(organizationId) && result.requestId !== requestId;
  const error = result.requestId === requestId ? result.error : "";
  const job = result.requestId === requestId ? result.job : null;
  const load = () => setRetryKey((value) => value + 1);
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!organization) return <EmptyState title="No organization available" description="Select an organization before viewing a job." />;
  if (!job) return <EmptyState title="Job not found" description="This requisition is unavailable or no longer exists." />;
  const salary = job.salaryMin || job.salaryMax ? `${job.salaryCurrency ?? ""} ${job.salaryMin?.toLocaleString() ?? "—"} - ${job.salaryMax?.toLocaleString() ?? "—"}`.trim() : "Not specified";
  return (
    <div className="space-y-8">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"><ArrowLeft className="size-3.5" /> Back to jobs</Link>
      <header className="border-b border-[#303030] pb-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-start"><div><div className="flex items-center gap-3"><Status value={job.status} /><span className="font-mono text-[9px] uppercase tracking-wider text-[#666]">{job.department || "No department"}</span></div><h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{job.title}</h1><p className="mt-3 flex items-center gap-2 text-sm text-[#8e8a84]"><MapPin className="size-3.5" /> {job.location || "Location not specified"}</p></div><div className="grid grid-cols-2 gap-px border border-[#303030] bg-[#303030] text-sm"><div className="bg-[#171717] p-4"><p className="font-mono text-[9px] uppercase tracking-wider text-[#666]">Employment</p><p className="mt-2">{job.employmentType?.replaceAll("_", " ") || "Not specified"}</p></div><div className="bg-[#171717] p-4"><p className="font-mono text-[9px] uppercase tracking-wider text-[#666]">Compensation</p><p className="mt-2">{salary}</p></div></div></div></header>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]"><div className="space-y-8"><section><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff4d1c]">Role description</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#bbb7b1]">{job.description || "No description has been provided."}</p></section><section><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff4d1c]">Responsibilities</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#bbb7b1]">{job.responsibilities || "No responsibilities have been provided."}</p></section></div><aside className="space-y-4"><div className="border border-[#303030] bg-[#181818] p-5"><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Required skills</h2>{job.skills?.length ? <ul className="mt-4 space-y-3">{job.skills.map((skill) => <li key={skill.id ?? skill.name} className="flex justify-between gap-3 text-sm"><span>{skill.name}</span><span className="text-[10px] text-[#777]">{skill.importance?.replaceAll("_", " ")}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#888]">No skills attached.</p>}</div><div className="border border-[#303030] bg-[#181818] p-5"><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Candidate activity</h2><p className="mt-4 text-sm leading-6 text-[#888]">Unavailable until the candidate pipeline API is connected.</p></div></aside></div>
    </div>
  );
}
