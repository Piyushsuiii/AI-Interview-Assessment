"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, LoaderCircle, Scale, Users } from "lucide-react";
import { useRecruiterApp } from "@/components/recruiter/app-shell";
import { getCollection, getErrorMessage, type Candidate } from "@/lib/api";
import { compareCandidates, displayName, formatScore, listComparisonCandidates, type Comparison } from "@/lib/intelligence-api";
import { IntelligenceEmpty, IntelligenceError, IntelligenceHeader, IntelligenceLoading, ScoreBar, label, panel } from "./intelligence-ui";

export function CompareView() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [state, setState] = useState<{ organizationId: string; candidates: Candidate[]; error: string }>({ organizationId: "", candidates: [], error: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [retry, setRetry] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    listComparisonCandidates(organizationId)
      .then((data) => {
        if (!active) return;
        setSelected([]);
        setComparison(null);
        setState({ organizationId, candidates: getCollection(data), error: "" });
      })
      .catch((error: unknown) => active && setState({ organizationId, candidates: [], error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [organizationId, retry]);

  function toggle(candidateId: string) {
    setSelected((current) => current.includes(candidateId) ? current.filter((id) => id !== candidateId) : current.length < 5 ? [...current, candidateId] : current);
    setComparison(null);
    setCompareError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || selected.length < 2 || selected.length > 5) return;
    setComparing(true);
    setCompareError("");
    try {
      setComparison(await compareCandidates(organizationId, selected));
    } catch (error) {
      setCompareError(getErrorMessage(error));
    } finally {
      setComparing(false);
    }
  }

  if (!organization) return <IntelligenceEmpty title="No organization available" description="Select an organization before comparing candidates." />;
  if (state.organizationId !== organizationId) return <IntelligenceLoading label="Loading organization candidates" />;
  if (state.error) return <IntelligenceError message={state.error} retry={() => setRetry((value) => value + 1)} />;

  return <div className="space-y-8">
    <IntelligenceHeader eyebrow="Decision workspace" title="Candidate comparison" description="Select two to five candidates from the current organization. The comparison is generated from their real interview and report records." action={<div className="grid size-12 place-items-center border border-[#3a3a3a] bg-[#1c1c1c]"><Scale className="size-5 text-[#ff6b3f]" /></div>} />
    {!state.candidates.length ? <IntelligenceEmpty title="No candidates to compare" description="This organization has no candidate records yet." /> : <form onSubmit={submit} className={`${panel} p-5 md:p-6`}><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-medium">Choose candidates</h2><p id="selection-help" className="mt-1 text-xs text-[#777]">{selected.length} of 5 selected · Minimum 2</p></div><button type="submit" disabled={selected.length < 2 || comparing} className="btn-orange inline-flex h-10 items-center gap-2 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50">{comparing ? <LoaderCircle className="size-4 animate-spin" /> : <Scale className="size-4" />} Compare selected</button></div><fieldset aria-describedby="selection-help" className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><legend className="sr-only">Candidates to compare</legend>{state.candidates.map((candidate) => { const active = selected.includes(candidate.id); const disabled = !active && selected.length >= 5; return <label key={candidate.id} className={`flex cursor-pointer items-center gap-3 border p-4 transition ${active ? "border-[#ff4d1c] bg-[#251b18]" : "border-[#303030] bg-[#151515] hover:border-[#515151]"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}><input type="checkbox" checked={active} disabled={disabled} onChange={() => toggle(candidate.id)} className="sr-only" /><span className={`grid size-5 shrink-0 place-items-center border ${active ? "border-[#ff4d1c] bg-[#ff4d1c]" : "border-[#555]"}`}>{active ? <Check className="size-3.5" /> : null}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{displayName(candidate)}</span><span className="mt-1 block truncate text-xs text-[#777]">{candidate.job?.title ?? candidate.email}</span></span></label>;})}</fieldset></form>}
    {compareError ? <IntelligenceError message={compareError} /> : null}
    {comparing ? <IntelligenceLoading label="Building evidence-backed comparison" /> : null}
    {comparison && !comparing ? <ComparisonResults comparison={comparison} /> : !comparing && selected.length >= 2 ? <div className="border border-dashed border-[#393939] p-6 text-center text-sm text-[#777]">Run the comparison to load current report data.</div> : null}
  </div>;
}

function ComparisonResults({ comparison }: { comparison: Comparison }) {
  if (!comparison.candidates.length) return <IntelligenceEmpty title="No comparable results" description="The API did not return comparison records for the selected candidates." />;
  const competencyNames = comparison.competencies?.length ? comparison.competencies : Array.from(new Set(comparison.candidates.flatMap((item) => item.competencies?.map((competency) => competency.name) ?? [])));
  return <section aria-labelledby="results-heading"><div className="flex items-end justify-between gap-3"><div><p className={label}>Returned analysis</p><h2 id="results-heading" className="mt-2 text-xl font-semibold">Side-by-side evidence</h2></div><span className="hidden font-mono text-[10px] uppercase tracking-wider text-[#777] sm:block">{comparison.candidates.length} candidate records</span></div><div className="mt-5 overflow-x-auto pb-2"><div className="grid min-w-max gap-3" style={{ gridTemplateColumns: `repeat(${comparison.candidates.length}, minmax(260px, 1fr))` }}>{comparison.candidates.map((item) => <article key={item.candidateId} className={`${panel} w-[min(78vw,340px)] p-5 sm:w-auto`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{displayName(item.candidate)}</h3><p className="mt-1 text-xs text-[#777]">{item.job?.title ?? item.candidate.email}</p></div><Users className="size-4 text-[#ff6b3f]" /></div><div className="mt-6 grid grid-cols-2 gap-3 border-y border-[#303030] py-4"><div><p className={label}>Score</p><p className="mt-2 text-xl font-semibold">{formatScore(item.score)}</p></div><div><p className={label}>Confidence</p><p className="mt-2 text-xl font-semibold">{formatScore(item.confidence)}</p></div></div><div className="mt-5"><p className={label}>Recommendation</p><p className="mt-2 text-sm font-medium text-[#ff8a68]">{item.recommendation?.replaceAll("_", " ") ?? "Not available"}</p></div><div className="mt-6 space-y-4">{competencyNames.map((name) => { const competency = item.competencies?.find((entry) => entry.name === name); return <div key={name}><div className="flex justify-between gap-3 text-xs"><span>{name}</span><span className="font-mono text-[#9d9891]">{formatScore(competency?.score)}</span></div><ScoreBar value={competency?.score} label={`${displayName(item.candidate)} ${name} score`} /></div>;})}</div><CompactList title="Strengths" items={item.strengths} /><CompactList title="Risks" items={item.risks} />{item.reportId && item.interviewId ? <Link href={`/reports/${encodeURIComponent(item.interviewId)}`} className="mt-6 inline-flex items-center gap-2 text-xs text-[#ff8a68] hover:text-white">Open full report <ArrowUpRight className="size-3.5" /></Link> : null}</article>)}</div></div></section>;
}

function CompactList({ title, items }: { title: string; items?: string[] }) {
  return <div className="mt-6"><p className={label}>{title}</p>{items?.length ? <ul className="mt-3 space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-[#aaa6a0]"><span className="mt-2 size-1 shrink-0 bg-[#ff6b3f]" />{item}</li>)}</ul> : <p className="mt-2 text-xs text-[#666]">None returned.</p>}</div>;
}
