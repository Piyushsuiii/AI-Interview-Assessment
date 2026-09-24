"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, Download, FileUp, MapPin, Trash2 } from "lucide-react";
import { candidateApiRequest, getErrorMessage, type CandidateApplication, type CandidateDashboard as DashboardData } from "@/lib/api";

function label(value: string) { return value.toLowerCase().replaceAll("_", " "); }
function isClosed(state: string) { return ["COMPLETED", "CANCELLED", "EXPIRED"].includes(state); }

export function CandidateDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  function load() {
    setError("");
    candidateApiRequest<DashboardData>("/candidate/portal/dashboard").then(setData).catch((requestError) => setError(getErrorMessage(requestError)));
  }
  useEffect(() => {
    let active = true;
    candidateApiRequest<DashboardData>("/candidate/portal/dashboard")
      .then((result) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); });
    return () => { active = false; };
  }, []);

  async function openInterview(interviewId: string) {
    setBusy(interviewId);
    try {
      const result = await candidateApiRequest<{ url: string }>(`/candidate/portal/interviews/${interviewId}/access-link`, { method: "POST" });
      window.location.assign(result.url);
    } catch (requestError) { setError(getErrorMessage(requestError)); setBusy(""); }
  }

  async function uploadResume(application: CandidateApplication, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(application.id);
    const body = new FormData();
    body.set("file", file);
    try { await candidateApiRequest(`/candidate/portal/applications/${application.id}/resume`, { method: "POST", body }); load(); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(""); event.target.value = ""; }
  }

  async function downloadResume(applicationId: string) {
    setBusy(applicationId);
    try {
      const result = await candidateApiRequest<{ url: string }>(`/candidate/portal/applications/${applicationId}/resume`);
      window.location.assign(result.url);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(""); }
  }

  async function deleteResume(applicationId: string) {
    if (!window.confirm("Remove this resume from the application?")) return;
    setBusy(applicationId);
    try { await candidateApiRequest(`/candidate/portal/applications/${applicationId}/resume`, { method: "DELETE" }); load(); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(""); }
  }

  if (!data && !error) return <div className="h-1 w-48 animate-pulse bg-[#d64a22]" />;

  return <div>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d64a22]">Application desk</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Your next steps,<br />in one place.</h1></div>
      <p className="max-w-sm text-sm leading-6 text-[#625e56]">Review your active applications, launch pending interviews, and keep each resume current.</p>
    </div>
    {error ? <div role="alert" className="mt-6 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
    {data ? <>
      <section className="mt-10 grid gap-px border border-[#c9c3b7] bg-[#c9c3b7] sm:grid-cols-3">
        {[{ label: "Applications", value: data.counts.applications, icon: BriefcaseBusiness }, { label: "Pending", value: data.counts.pendingInterviews, icon: Clock3 }, { label: "Completed", value: data.counts.completedInterviews, icon: CheckCircle2 }].map(({ label: itemLabel, value, icon: Icon }) => <div key={itemLabel} className="bg-[#f5f1e9] p-5"><Icon className="size-4 text-[#d64a22]" /><strong className="mt-6 block text-3xl tracking-[-0.04em]">{value.toString().padStart(2, "0")}</strong><span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-[#777168]">{itemLabel}</span></div>)}
      </section>
      <section className="mt-12"><div className="flex items-center justify-between border-b border-[#bdb7ac] pb-3"><h2 className="text-xl font-semibold tracking-tight">Applications</h2><span className="font-mono text-[9px] uppercase tracking-widest text-[#777168]">Most recent first</span></div>
        {!data.applications.length ? <p className="border-b border-[#cbc5ba] py-10 text-sm text-[#625e56]">No applications are linked to this account yet.</p> : null}
        <div>{data.applications.map((application, index) => <article key={application.id} className="grid gap-6 border-b border-[#cbc5ba] py-7 lg:grid-cols-[48px_1fr_1fr]">
          <span className="font-mono text-xs text-[#918b81]">{String(index + 1).padStart(2, "0")}</span>
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold tracking-tight">{application.job.title}</h3><span className="border border-[#c9c3b7] px-2 py-1 font-mono text-[9px] uppercase tracking-wider">{label(application.status)}</span></div><p className="mt-2 text-sm text-[#625e56]">{application.organization.name}</p>{application.job.location ? <p className="mt-1 flex items-center gap-1.5 text-xs text-[#777168]"><MapPin className="size-3" />{application.job.location}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2"><label className="flex cursor-pointer items-center gap-2 border border-[#aaa398] px-3 py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#f5f1e9]"><FileUp className="size-3.5" />{application.resumeFileName ? "Replace resume" : "Add resume"}<input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy === application.id} onChange={(event) => uploadResume(application, event)} /></label>{application.resumeFileName ? <><button onClick={() => downloadResume(application.id)} className="flex items-center gap-2 border border-[#aaa398] px-3 py-2 font-mono text-[9px] uppercase tracking-widest"><Download className="size-3.5" />View</button><button onClick={() => deleteResume(application.id)} aria-label="Delete resume" className="border border-[#aaa398] px-3 py-2"><Trash2 className="size-3.5" /></button></> : null}</div>
            {application.resumeFileName ? <p className="mt-2 truncate text-[11px] text-[#777168]">{application.resumeFileName}</p> : null}
          </div>
          <div className="space-y-2">{application.interviews.length ? application.interviews.map((interview) => <div key={interview.id} className="flex items-center justify-between border border-[#c9c3b7] bg-[#f5f1e9] p-4"><div><span className="font-mono text-[9px] uppercase tracking-widest text-[#777168]">Interview</span><p className="mt-1 text-sm font-medium capitalize">{label(interview.state)}</p></div>{!isClosed(interview.state) ? <button disabled={busy === interview.id} onClick={() => openInterview(interview.id)} className="flex items-center gap-2 bg-[#171714] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white disabled:opacity-50">{interview.state === "INVITED" ? "Begin" : "Continue"}<ArrowUpRight className="size-3.5" /></button> : <CheckCircle2 className="size-4 text-[#777168]" />}</div>) : <div className="border border-dashed border-[#c9c3b7] p-4 text-sm text-[#777168]">Interview details will appear here when scheduled.</div>}</div>
        </article>)}</div>
      </section>
    </> : null}
  </div>;
}
