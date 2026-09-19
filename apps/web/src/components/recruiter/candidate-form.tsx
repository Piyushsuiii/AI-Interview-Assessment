"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { apiRequest, getErrorMessage, getJobs, type Candidate, type Job } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, Input, PageSkeleton, Select, SubmitButton } from "./ui";

export function CandidateForm() {
  const router = useRouter();
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [jobsState, setJobsState] = useState<{ key: string; jobs: Job[]; error: string }>({ key: "", jobs: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdCandidateId, setCreatedCandidateId] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Job[] | { jobs?: Job[]; items?: Job[] }>(`/organizations/${organizationId}/jobs`, {}, organizationId)
      .then((data) => active && setJobsState({ key: organizationId, jobs: getJobs(data), error: "" }))
      .catch((requestError: unknown) => active && setJobsState({ key: organizationId, jobs: [], error: getErrorMessage(requestError) }));
    return () => { active = false; };
  }, [organizationId, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const form = new FormData(event.currentTarget);
    const body = { email: String(form.get("email")), firstName: String(form.get("firstName") || "") || undefined, lastName: String(form.get("lastName") || "") || undefined, jobId: String(form.get("jobId")) };
    const resume = form.get("resume");
    setBusy(true); setError("");
    let createdId = "";
    try {
      const candidate = await apiRequest<Candidate>(`/organizations/${organization.id}/candidates`, { method: "POST", body: JSON.stringify(body) }, organization.id);
      createdId = candidate.id;
      setCreatedCandidateId(candidate.id);
      if (resume instanceof File && resume.size) {
        const upload = new FormData();
        upload.set("resume", resume);
        await apiRequest(`/organizations/${organization.id}/candidates/${candidate.id}/resume`, { method: "POST", body: upload }, organization.id);
      }
      router.push(`/candidates/${candidate.id}`); router.refresh();
    } catch (requestError) { setError(createdId ? `Candidate created, but the resume upload failed: ${getErrorMessage(requestError)}` : getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }

  if (!organization) return <EmptyState title="Select an organization" description="A candidate must belong to an organization." />;
  if (jobsState.key !== organizationId) return <PageSkeleton />;
  if (jobsState.error) return <ErrorState message={jobsState.error} onRetry={() => setRetry((value) => value + 1)} />;
  if (!jobsState.jobs.length) return <EmptyState title="Create a job first" description="Candidates must be connected to a real job. Create a requisition before adding a candidate." action={<Link href="/jobs/new" className="btn-orange inline-flex h-10 items-center px-4 font-mono text-xs uppercase">Create job</Link>} />;

  return <div className="mx-auto max-w-3xl"><Link href="/candidates" className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"><ArrowLeft className="size-3.5" /> Back to candidates</Link><header className="mt-6"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">New candidate</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Add to the pipeline</h1><p className="mt-2 text-sm text-[#8e8a84]">Connect this person to a requisition in {organization.name}.</p></header><form onSubmit={submit} className="mt-8 space-y-6"><fieldset className="grid gap-5 border border-[#303030] bg-[#181818] p-5 sm:grid-cols-2 md:p-7"><legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">Candidate profile</legend><Input name="firstName" label="First name" maxLength={100} autoComplete="given-name" /><Input name="lastName" label="Last name" maxLength={100} autoComplete="family-name" /><Input name="email" label="Email" type="email" required autoComplete="email" className="sm:col-span-2" /><Select name="jobId" label="Job" required className="sm:col-span-2" defaultValue=""><option value="" disabled>Select a requisition</option>{jobsState.jobs.map((job) => <option key={job.id} value={job.id}>{job.title} ({job.status.toLowerCase()})</option>)}</Select><Input name="resume" label="Resume PDF" type="file" accept="application/pdf,.pdf" className="sm:col-span-2 file:mr-4 file:border-0 file:bg-[#292929] file:px-3 file:py-2 file:text-xs file:text-white" hint="Optional private PDF, maximum 10 MB." /></fieldset>{error ? <div role="alert" className="border border-red-950 bg-red-950/20 px-4 py-3 text-sm text-red-300"><p>{error}</p>{createdCandidateId ? <Link href={`/candidates/${createdCandidateId}`} className="mt-2 inline-flex text-xs text-white underline">Open candidate and retry upload</Link> : null}</div> : null}<div className="ml-auto w-full sm:w-52">{createdCandidateId && error ? <Link href={`/candidates/${createdCandidateId}`} className="btn-orange flex h-11 items-center justify-center px-5 text-xs">Open candidate</Link> : <SubmitButton busy={busy}>Create candidate</SubmitButton>}</div></form></div>;
}
