"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, Quote, ShieldAlert } from "lucide-react";
import { useRecruiterApp } from "@/components/recruiter/app-shell";
import { getErrorMessage } from "@/lib/api";
import { displayName, formatScore, getInterviewReport, overrideRecommendation, type Evidence, type InterviewReport } from "@/lib/intelligence-api";
import { EvidenceText, IntelligenceEmpty, IntelligenceError, IntelligenceHeader, IntelligenceLoading, ScoreBar, StatusPill, label, panel } from "./intelligence-ui";

const recommendations = ["STRONG_HIRE", "HIRE", "MIXED", "NO_HIRE", "STRONG_NO_HIRE"];

export function ReportView({ interviewId }: { interviewId: string }) {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const requestKey = `${organizationId}:${interviewId}`;
  const [state, setState] = useState<{ key: string; report: InterviewReport | null; error: string }>({ key: "", report: null, error: "" });
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    getInterviewReport(organizationId, interviewId)
      .then((report) => active && setState({ key: requestKey, report, error: "" }))
      .catch((error: unknown) => active && setState({ key: requestKey, report: null, error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [interviewId, organizationId, requestKey, retry]);

  async function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const form = new FormData(event.currentTarget);
    const recommendation = String(form.get("recommendation") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!reason) { setFormError("A reason is required for an auditable override."); return; }
    setSaving(true);
    setSaved(false);
    setFormError("");
    try {
      const report = await overrideRecommendation(organizationId, interviewId, recommendation, reason);
      setState({ key: requestKey, report, error: "" });
      setSaved(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!organization) return <IntelligenceEmpty title="No organization available" description="Select an organization to view this report." />;
  if (state.key !== requestKey) return <IntelligenceLoading label="Loading evidence-backed report" />;
  if (state.error) return <IntelligenceError message={state.error} retry={() => setRetry((value) => value + 1)} />;
  if (!state.report) return <IntelligenceEmpty title="Report unavailable" description="No evaluation report was returned for this interview." />;
  const report = state.report;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/interviews/${encodeURIComponent(interviewId)}`} className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"><ArrowLeft className="size-3.5" /> Interview replay</Link>{report.status ? <StatusPill>{report.status.replaceAll("_", " ")}</StatusPill> : null}</div>
    <IntelligenceHeader eyebrow="Decision report" title={displayName(report.candidate)} description={`${report.assessment?.title ?? "Interview evaluation"} · Scores and conclusions are shown with the evidence returned by the evaluation service.`} />
    <section className="grid gap-px border border-[#303030] bg-[#303030] md:grid-cols-[1.3fr_1fr_1fr]" aria-label="Decision summary">
      <div className="bg-[#1b1b1b] p-6 md:p-8"><p className={label}>Recommendation</p><p className="mt-4 text-3xl font-semibold tracking-tight text-[#ff6b3f]">{report.recommendation?.replaceAll("_", " ") ?? "Pending"}</p>{report.summary ? <p className="mt-4 text-sm leading-7 text-[#aaa6a0]">{report.summary}</p> : null}</div>
      <div className="bg-[#181818] p-6 md:p-8"><p className={label}>Overall score</p><p className="mt-4 text-3xl font-semibold">{formatScore(report.score)}</p><ScoreBar value={report.score} label="Overall evaluation score" /></div>
      <div className="bg-[#181818] p-6 md:p-8"><p className={label}>Confidence</p><p className="mt-4 text-3xl font-semibold">{formatScore(report.confidence)}</p><ScoreBar value={report.confidence} label="Evaluation confidence" /></div>
    </section>

    <section aria-labelledby="competencies-heading"><h2 id="competencies-heading" className={label}>Competencies</h2>{report.competencies?.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{report.competencies.map((competency, index) => <article key={competency.id ?? `${competency.name}-${index}`} className={`${panel} p-5`}><div className="flex items-start justify-between gap-4"><h3 className="font-medium">{competency.name}</h3><span className="font-mono text-xs text-[#ff8a68]">{formatScore(competency.score)}</span></div><ScoreBar value={competency.score} label={`${competency.name} score`} />{competency.summary ? <p className="mt-4 text-sm leading-6 text-[#9c9790]">{competency.summary}</p> : null}{competency.evidence?.length ? <EvidenceList items={competency.evidence} compact /> : <p className="mt-4 text-xs text-[#68645f]">No supporting evidence returned.</p>}</article>)}</div> : <p className="mt-4 border border-dashed border-[#383838] p-5 text-sm text-[#888]">No competency results were returned.</p>}</section>

    <div className="grid gap-6 lg:grid-cols-2"><ReportList title="Strengths" items={report.strengths} tone="positive" /><ReportList title="Weaknesses and risks" items={report.weaknesses} tone="caution" /></div>
    {report.evidence?.length ? <section><h2 className={label}>Key evidence</h2><div className="mt-4"><EvidenceList items={report.evidence} /></div></section> : null}

    <section aria-labelledby="technical-heading"><h2 id="technical-heading" className={label}>Technical signals</h2><div className="mt-4 grid gap-4 lg:grid-cols-3"><SignalCard title="Coding" score={report.coding?.score} summary={report.coding?.summary} evidence={report.coding?.evidence} /><SignalCard title="System design" score={report.systemDesign?.score} summary={report.systemDesign?.summary} evidence={report.systemDesign?.evidence} /><article className={`${panel} p-5`}><div className="flex items-center justify-between gap-3"><h3 className="font-medium">Integrity</h3><ShieldAlert className="size-4 text-amber-400" /></div><p className="mt-3 font-mono text-xs uppercase tracking-wider text-[#c9c4bc]">{report.integrity?.status?.replaceAll("_", " ") ?? "Not assessed"}</p>{report.integrity?.summary ? <p className="mt-4 text-sm leading-6 text-[#9c9790]">{report.integrity.summary}</p> : null}{report.integrity?.flags?.length ? <EvidenceList items={report.integrity.flags} compact /> : <p className="mt-4 text-xs text-[#68645f]">No integrity flags returned.</p>}</article></div></section>

    <section className="grid gap-6 border border-[#383838] bg-[#171717] p-5 md:p-7 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="override-heading"><div><p className={label}>Human review</p><h2 id="override-heading" className="mt-3 text-xl font-semibold">Override recommendation</h2><p className="mt-3 text-sm leading-6 text-[#918c86]">An override does not erase the model output. It records the reviewer&apos;s recommendation and required rationale for the audit trail.</p>{report.override ? <div className="mt-5 border-l-2 border-[#ff4d1c] pl-4"><p className="text-sm font-medium">Current override: {report.override.recommendation.replaceAll("_", " ")}</p><p className="mt-2 text-sm leading-6 text-[#9c9790]">{report.override.reason}</p></div> : null}</div><form onSubmit={submitOverride} className="space-y-4"><label className="grid gap-2 text-sm" htmlFor="recommendation"><span>Recommendation</span><select id="recommendation" name="recommendation" defaultValue={report.override?.recommendation ?? report.recommendation ?? ""} required className="h-11 border border-[#3a3a3a] bg-[#111] px-3 outline-none focus:border-[#ff4d1c]"><option value="" disabled>Select recommendation</option>{recommendations.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="grid gap-2 text-sm" htmlFor="reason"><span>Reason <span className="text-[#ff8a68]">required</span></span><textarea id="reason" name="reason" required minLength={10} rows={4} placeholder="Explain the evidence and judgment behind this decision." className="resize-y border border-[#3a3a3a] bg-[#111] p-3 leading-6 outline-none placeholder:text-[#64605b] focus:border-[#ff4d1c]" /></label>{formError ? <p role="alert" className="text-sm text-red-300">{formError}</p> : null}{saved ? <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="size-4" /> Override recorded.</p> : null}<button type="submit" disabled={saving} className="btn-orange inline-flex h-11 w-full items-center justify-center gap-2 px-5 text-xs disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : null} Record override</button></form></section>
  </div>;
}

function EvidenceList({ items, compact = false }: { items: Array<string | Evidence>; compact?: boolean }) {
  return <ul className={`${compact ? "mt-4" : "grid gap-3 sm:grid-cols-2"} space-y-2`}>{items.map((item, index) => <li key={typeof item === "string" ? `${item}-${index}` : item.id ?? `${item.quote ?? item.text}-${index}`} className={`${compact ? "border-t border-[#2c2c2c] pt-3" : panel + " p-4"} text-sm leading-6 text-[#c6c1ba]`}><div className="flex gap-3"><Quote className="mt-1 size-3.5 shrink-0 text-[#ff6b3f]" /><EvidenceText item={item} /></div></li>)}</ul>;
}

function ReportList({ title, items, tone }: { title: string; items?: Array<string | Evidence>; tone: "positive" | "caution" }) {
  return <section className={`${panel} p-5`}><h2 className={label}>{title}</h2>{items?.length ? <ul className="mt-4 space-y-3">{items.map((item, index) => <li key={typeof item === "string" ? `${item}-${index}` : item.id ?? index} className="flex gap-3 text-sm leading-6 text-[#c7c2bb]"><span className={`mt-2 size-1.5 shrink-0 ${tone === "positive" ? "bg-emerald-400" : "bg-amber-400"}`} /><EvidenceText item={item} /></li>)}</ul> : <p className="mt-4 text-sm text-[#777]">None returned.</p>}</section>;
}

function SignalCard({ title, score, summary, evidence }: { title: string; score?: number | null; summary?: string | null; evidence?: Evidence[] }) {
  return <article className={`${panel} p-5`}><div className="flex items-center justify-between gap-3"><h3 className="font-medium">{title}</h3>{typeof score === "number" ? <span className="font-mono text-xs text-[#ff8a68]">{formatScore(score)}</span> : null}</div>{typeof score === "number" ? <ScoreBar value={score} label={`${title} score`} /> : null}{summary ? <p className="mt-4 text-sm leading-6 text-[#9c9790]">{summary}</p> : <p className="mt-4 text-xs text-[#68645f]">No evaluation returned.</p>}{evidence?.length ? <EvidenceList items={evidence} compact /> : null}</article>;
}
