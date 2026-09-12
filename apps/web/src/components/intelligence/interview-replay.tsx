"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileSearch, Flag, LoaderCircle, MessageSquareText, Play } from "lucide-react";
import { useRecruiterApp } from "@/components/recruiter/app-shell";
import { getErrorMessage } from "@/lib/api";
import { displayName, getInterviewReplay, triggerEvaluation, type InterviewReplay } from "@/lib/intelligence-api";
import { IntelligenceEmpty, IntelligenceError, IntelligenceHeader, IntelligenceLoading, StatusPill, label, panel } from "./intelligence-ui";

export function InterviewReplayView({ interviewId }: { interviewId: string }) {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const requestKey = `${organizationId}:${interviewId}`;
  const [state, setState] = useState<{ key: string; replay: InterviewReplay | null; error: string }>({ key: "", replay: null, error: "" });
  const [retry, setRetry] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    getInterviewReplay(organizationId, interviewId)
      .then((replay) => active && setState({ key: requestKey, replay, error: "" }))
      .catch((error: unknown) => active && setState({ key: requestKey, replay: null, error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [interviewId, organizationId, requestKey, retry]);

  async function evaluate() {
    if (!organizationId) return;
    setEvaluating(true);
    setActionError("");
    try {
      await triggerEvaluation(organizationId, interviewId, Boolean(state.replay?.evaluation));
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setEvaluating(false);
    }
  }

  if (!organization) return <IntelligenceEmpty title="No organization available" description="Select an organization to inspect this interview." />;
  if (state.key !== requestKey) return <IntelligenceLoading label="Loading interview replay" />;
  if (state.error) return <IntelligenceError message={state.error} retry={() => setRetry((value) => value + 1)} />;
  if (!state.replay) return <IntelligenceEmpty title="Interview unavailable" description="No interview replay was returned for this organization." />;

  const replay = state.replay;
  const evaluationStatus = replay.evaluation?.status ?? "NOT_STARTED";
  const events = [...(replay.timeline ?? [])].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : a.timestampMs;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : b.timestampMs;
    return typeof aTime === "number" && typeof bTime === "number" && !Number.isNaN(aTime) && !Number.isNaN(bTime) ? aTime - bTime : (a.sequence ?? 0) - (b.sequence ?? 0);
  });

  return <div className="space-y-8">
    <Link href="/candidates" className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"><ArrowLeft className="size-3.5" /> Back to candidates</Link>
    <IntelligenceHeader eyebrow="Interview replay" title={displayName(replay.candidate)} description={`${replay.assessment?.title ?? "Interview"} · A chronological record of submitted answers, evidence, and integrity events.`} action={<div className="flex flex-wrap items-center gap-3"><StatusPill>{evaluationStatus.replaceAll("_", " ")}</StatusPill><button type="button" onClick={evaluate} disabled={evaluating} className="btn-orange inline-flex h-10 items-center gap-2 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60">{evaluating ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} {replay.evaluation ? "Run evaluation again" : "Evaluate interview"}</button></div>} />
    {actionError ? <p role="alert" className="border border-red-950 bg-red-950/10 p-3 text-sm text-red-300">{actionError}</p> : null}
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric labelText="Interview state" value={(replay.state ?? replay.status ?? "Unknown").replaceAll("_", " ")} />
      <Metric labelText="Started" value={formatDate(replay.startedAt)} />
      <Metric labelText="Completed" value={formatDate(replay.completedAt)} />
    </div>
    <section aria-labelledby="timeline-heading">
      <div className="flex items-center justify-between"><h2 id="timeline-heading" className={label}>Timeline</h2><span className="font-mono text-[10px] text-[#68645f]">{events.length} events</span></div>
      {events.length ? <ol className="relative mt-5 space-y-4 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-[#353535]">
        {events.map((event) => {
          const integrity = Boolean(event.integrity) || event.type.toLowerCase().includes("integrity");
          const evidence = event.evidence?.length ?? 0;
          return <li key={event.id} className="relative grid grid-cols-[40px_1fr] gap-4">
            <span className={`z-10 grid size-10 place-items-center border ${integrity ? "border-amber-700 bg-amber-950 text-amber-300" : event.answer ? "border-[#40584d] bg-[#17271f] text-emerald-300" : "border-[#3a3a3a] bg-[#1d1d1d] text-[#aaa6a0]"}`} aria-hidden="true">{integrity ? <Flag className="size-4" /> : event.answer ? <MessageSquareText className="size-4" /> : <CheckCircle2 className="size-4" />}</span>
            <article className={`${panel} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><StatusPill>{event.type.replaceAll("_", " ")}</StatusPill><time className="font-mono text-[10px] text-[#777]">{event.timestamp ? formatDate(event.timestamp) : typeof event.timestampMs === "number" ? formatDuration(event.timestampMs) : "Time unavailable"}</time></div>
              {event.prompt ? <div className="mt-5"><p className={label}>Question</p><p className="mt-2 text-sm leading-6 text-[#d8d4cd]">{event.prompt}</p></div> : null}
              {event.answer ? <div className="mt-5 border-l-2 border-[#ff4d1c] pl-4"><p className={label}>Submitted answer</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#ece8e1]">{event.answer}</p></div> : null}
              {event.detail || event.integrity?.detail ? <p className={`mt-4 text-sm leading-6 ${integrity ? "text-amber-200" : "text-[#9b9690]"}`}>{event.integrity?.detail ?? event.detail}</p> : null}
              {evidence ? <div className="mt-4 flex items-center gap-2 text-xs text-[#b9b4ad]"><FileSearch className="size-3.5 text-[#ff6b3f]" /> {evidence} evidence {evidence === 1 ? "marker" : "markers"}</div> : null}
            </article>
          </li>;
        })}
      </ol> : <div className="mt-5"><IntelligenceEmpty title="No replay events" description="The API returned this interview, but no timeline events have been recorded." /></div>}
    </section>
  </div>;
}

function Metric({ labelText, value }: { labelText: string; value: string }) {
  return <div className={`${panel} p-5`}><p className={label}>{labelText}</p><p className="mt-3 text-sm font-medium text-[#e7e3dc]">{value}</p></div>;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
