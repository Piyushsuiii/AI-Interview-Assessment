"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { apiRequest, getErrorMessage, type Job } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, Input, Select, SubmitButton } from "./ui";

export function JobForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { organization } = useRecruiterApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);

  async function analyzeJob() {
    if (!organization || !formRef.current) return;
    const form = new FormData(formRef.current);
    const title = String(form.get("title") ?? "");
    const description = String(form.get("description") ?? "");
    if (title.trim().length < 2 || description.trim().length < 40) {
      setError("Add a job title and at least 40 characters of role description before AI analysis.");
      return;
    }
    setAnalyzing(true); setError("");
    try {
      const result = await apiRequest<{ data: JobAnalysis }>(`/organizations/${organization.id}/ai/job-analysis`, {
        method: "POST",
        body: JSON.stringify({ title, description }),
      }, organization.id);
      setAnalysis(result.data);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setAnalyzing(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => { const value = form.get(name); return value ? Number(value) : undefined; };
    const body = {
      title: form.get("title"), description: form.get("description") || undefined,
      department: form.get("department") || undefined, location: form.get("location") || undefined,
      employmentType: form.get("employmentType") || undefined, experienceLevel: form.get("experienceLevel") || undefined,
      salaryMin: optionalNumber("salaryMin"), salaryMax: optionalNumber("salaryMax"), salaryCurrency: form.get("salaryCurrency") || undefined,
      responsibilities: String(form.get("responsibilities") ?? "").split("\n").map((item) => item.trim()).filter(Boolean), status: form.get("status"),
      skills: analysis?.competencies.map(({ name, importance }) => ({ name, importance })) ?? [],
    };
    if (body.salaryMin && body.salaryMax && body.salaryMin > body.salaryMax) { setError("Minimum salary cannot exceed maximum salary."); setBusy(false); return; }
    try {
      const created = await apiRequest<Job>(`/organizations/${organization.id}/jobs`, { method: "POST", body: JSON.stringify(body) }, organization.id);
      router.push(`/jobs/${created.id}`); router.refresh();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }

  if (!organization) return <EmptyState title="Select an organization" description="A job must belong to an organization. Select one from the workspace header to continue." />;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"><ArrowLeft className="size-3.5" /> Back to jobs</Link>
      <div className="mt-6"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">New requisition</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Define the role</h1><p className="mt-2 text-sm text-[#8e8a84]">Capture the hiring brief for {organization.name}. You can refine the role after creation.</p></div>
      <form ref={formRef} onSubmit={submit} className="mt-8 space-y-8">
        <fieldset className="grid gap-5 border border-[#303030] bg-[#181818] p-5 sm:grid-cols-2 md:p-7"><legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">Role basics</legend><Input name="title" label="Job title" placeholder="Senior Product Engineer" required maxLength={160} /><Input name="department" label="Department" placeholder="Engineering" maxLength={100} /><Input name="location" label="Location" placeholder="London / Remote" maxLength={160} /><Select name="employmentType" label="Employment type" defaultValue="FULL_TIME"><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="TEMPORARY">Temporary</option><option value="INTERNSHIP">Internship</option></Select><Select name="experienceLevel" label="Experience level" defaultValue="MID"><option value="ENTRY">Entry</option><option value="MID">Mid-level</option><option value="SENIOR">Senior</option><option value="LEAD">Lead</option><option value="EXECUTIVE">Executive</option></Select><Select name="status" label="Initial status" defaultValue="DRAFT"><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select></fieldset>
        <fieldset className="grid gap-5 border border-[#303030] bg-[#181818] p-5 sm:grid-cols-3 md:p-7"><legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">Compensation</legend><Input name="salaryMin" label="Minimum" type="number" min="0" step="1" inputMode="numeric" /><Input name="salaryMax" label="Maximum" type="number" min="0" step="1" inputMode="numeric" /><Input name="salaryCurrency" label="Currency" defaultValue="USD" maxLength={3} className="uppercase" /></fieldset>
        <fieldset className="grid gap-5 border border-[#303030] bg-[#181818] p-5 md:p-7"><legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">Hiring brief</legend><label className="grid gap-2 text-sm text-[#d5d1ca]" htmlFor="description"><span className="font-medium">Role description</span><textarea id="description" name="description" rows={6} className="border border-[#353535] bg-[#151515] p-3 text-[#f0ede8] outline-none focus:border-[#ff4d1c] focus:ring-2 focus:ring-[#ff4d1c]/20" placeholder="Describe the role, its purpose, and the impact this person will have." /></label><label className="grid gap-2 text-sm text-[#d5d1ca]" htmlFor="responsibilities"><span className="font-medium">Responsibilities</span><textarea id="responsibilities" name="responsibilities" rows={6} className="border border-[#353535] bg-[#151515] p-3 text-[#f0ede8] outline-none focus:border-[#ff4d1c] focus:ring-2 focus:ring-[#ff4d1c]/20" placeholder="One responsibility per line." /></label><button type="button" onClick={analyzeJob} disabled={analyzing} className="inline-flex w-fit items-center gap-2 border border-[#ff4d1c]/60 bg-[#ff4d1c]/10 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ff8a68] transition hover:bg-[#ff4d1c]/20 disabled:opacity-50"><Sparkles className="size-3.5" />{analyzing ? "Analyzing role..." : "Generate skill matrix"}</button></fieldset>
        {analysis ? <section aria-live="polite" className="border border-[#30465c] bg-[#111a22] p-5 md:p-7"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">AI role intelligence</p><p className="mt-3 text-sm leading-6 text-[#b8c5cf]">{analysis.summary}</p><div className="mt-5 flex flex-wrap gap-2">{analysis.competencies.map((skill) => <span key={skill.name} title={skill.rationale} className="border border-[#35536b] bg-[#172735] px-3 py-1.5 text-xs text-[#d8e9f5]">{skill.name} · {skill.importance.replaceAll("_", " ")}</span>)}</div><p className="mt-5 text-xs text-[#7890a2]">These competencies will be attached to the job and remain editable.</p></section> : null}
        {error ? <p role="alert" className="border border-red-950 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</p> : null}
        <div className="ml-auto w-full sm:w-52"><SubmitButton busy={busy}>Create job</SubmitButton></div>
      </form>
    </div>
  );
}

type JobAnalysis = {
  summary: string;
  competencies: Array<{ name: string; importance: "NICE_TO_HAVE" | "REQUIRED" | "CRITICAL"; rationale: string }>;
  interviewPlan: Array<{ section: string; durationMinutes: number; topics: string[] }>;
  evaluationCriteria: string[];
};
