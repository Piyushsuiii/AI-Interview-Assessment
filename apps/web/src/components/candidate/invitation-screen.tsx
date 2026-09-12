"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  getCandidateInvitation,
  getCurrentQuestion,
  PublicInvitationError,
  startCandidateInterview,
  submitCandidateAnswer,
  type CandidateInvitation,
  type CandidateSession,
  type CurrentQuestion,
} from "./public-api";
import { CodingWorkspace } from "./coding-workspace";
import { IntegrityMonitor } from "./integrity-monitor";
import { SystemDesignWorkspace } from "./system-design-workspace";

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; invitation: CandidateInvitation }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "error" };

const terminalStatuses = new Set(["COMPLETED", "EVALUATED", "EVALUATION"]);

function normalizedStatus(value?: string) {
  return (value ?? "INVITED").toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function sessionFor(invitation: CandidateInvitation): CandidateSession {
  return invitation.session ?? invitation.interview ?? { status: invitation.status };
}

function invitationHasExpired(invitation: CandidateInvitation) {
  if (
    normalizedStatus(invitation.status) === "EXPIRED" ||
    normalizedStatus(sessionFor(invitation).status) === "EXPIRED"
  ) return true;
  return Boolean(
    invitation.expiresAt &&
      new Date(invitation.expiresAt).getTime() <= Date.now() &&
      normalizedStatus(sessionFor(invitation).status) === "INVITED",
  );
}

function displayName(invitation: CandidateInvitation) {
  const name = [invitation.candidate.firstName, invitation.candidate.lastName]
    .filter(Boolean)
    .join(" ");
  return name || invitation.candidate.email;
}

function formatStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#171713]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#d8d2c7] pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-[#171713] font-mono text-xs font-bold text-[#f4f1eb]" aria-hidden="true">AI</span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Interview workspace</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#716d65]">Private candidate access</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#716d65] sm:flex">
            <ShieldCheck className="size-4 text-[#2f6d55]" aria-hidden="true" /> Secure invitation
          </div>
        </header>
        <div className="flex flex-1 items-center py-10 sm:py-14">{children}</div>
      </div>
    </main>
  );
}

function LoadingView() {
  return (
    <InvitationShell>
      <div className="w-full" role="status" aria-live="polite">
        <div className="mb-8 h-3 w-28 animate-pulse bg-[#ded9d0]" />
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="h-80 animate-pulse border border-[#ded9d0] bg-[#ebe7df]" />
          <div className="h-80 animate-pulse border border-[#ded9d0] bg-[#ebe7df]" />
        </div>
        <span className="sr-only">Loading your invitation</span>
      </div>
    </InvitationShell>
  );
}

function MessageView({
  kind,
  onRetry,
}: {
  kind: "expired" | "invalid" | "error";
  onRetry: () => void;
}) {
  const copy = {
    expired: {
      eyebrow: "Invitation expired",
      title: "This interview link is no longer active.",
      body: "Contact the hiring team that invited you if you believe you should still have access.",
    },
    invalid: {
      eyebrow: "Invitation unavailable",
      title: "We could not find this interview invitation.",
      body: "Check that you opened the complete link from your invitation email, or ask the hiring team for a new one.",
    },
    error: {
      eyebrow: "Connection interrupted",
      title: "We could not load your interview right now.",
      body: "Your interview has not been changed. Check your connection and try again.",
    },
  }[kind];

  return (
    <InvitationShell>
      <section className="mx-auto w-full max-w-2xl border border-[#d8d2c7] bg-white p-7 shadow-[8px_8px_0_#ded9d0] sm:p-10" role={kind === "error" ? "alert" : undefined}>
        <AlertCircle className="mb-7 size-7 text-[#c54b2c]" aria-hidden="true" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a13d25]">{copy.eyebrow}</p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{copy.title}</h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#625e57]">{copy.body}</p>
        {kind === "error" ? (
          <button type="button" onClick={onRetry} className="mt-8 inline-flex h-11 items-center justify-center border border-[#171713] px-5 font-mono text-xs font-bold uppercase tracking-[0.1em] transition hover:bg-[#171713] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c54b2c]">
            Try again
          </button>
        ) : null}
      </section>
    </InvitationShell>
  );
}

function Summary({ invitation }: { invitation: CandidateInvitation }) {
  const details = [invitation.job.department, invitation.job.location, invitation.job.employmentType].filter(Boolean);
  return (
    <aside className="border border-[#d8d2c7] bg-[#ebe7df] p-6 sm:p-7" aria-labelledby="summary-heading">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#716d65]">Prepared by</p>
      <h2 id="summary-heading" className="mt-2 text-xl font-semibold tracking-tight">{invitation.organization.name}</h2>
      <div className="my-6 h-px bg-[#d0cabf]" />
      <dl className="space-y-6">
        <div>
          <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#716d65]"><BriefcaseBusiness className="size-3.5" aria-hidden="true" /> Role</dt>
          <dd className="mt-2 font-medium">{invitation.job.title}</dd>
          {details.length ? <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#716d65]">{details.map((detail) => <span key={detail}>{detail}</span>)}</dd> : null}
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#716d65]">Assessment</dt>
          <dd className="mt-2 font-medium">{invitation.assessment.title}</dd>
          <dd className="mt-2 flex items-center gap-2 text-xs text-[#716d65]"><Clock3 className="size-3.5" aria-hidden="true" /> Approximately {invitation.assessment.durationMins} minutes</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#716d65]">Candidate</dt>
          <dd className="mt-2 font-medium">{displayName(invitation)}</dd>
          {displayName(invitation) !== invitation.candidate.email ? <dd className="mt-1 break-all text-xs text-[#716d65]">{invitation.candidate.email}</dd> : null}
        </div>
      </dl>
    </aside>
  );
}

function CompletedView({ invitation }: { invitation: CandidateInvitation }) {
  const session = sessionFor(invitation);
  return (
    <InvitationShell>
      <div className="grid w-full gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="border border-[#d8d2c7] bg-white p-7 shadow-[8px_8px_0_#ded9d0] sm:p-10">
          <CheckCircle2 className="size-8 text-[#2f6d55]" aria-hidden="true" />
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-[#2f6d55]">Interview complete</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Thank you, {invitation.candidate.firstName || "your response has been received"}.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#625e57]">Your interview is recorded as complete. There is nothing else you need to submit here.</p>
          {formatDate(session.completedAt) ? <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.12em] text-[#716d65]">Completed {formatDate(session.completedAt)}</p> : null}
        </section>
        <Summary invitation={invitation} />
      </div>
    </InvitationShell>
  );
}

function InterviewQuestionPanel({ token }: { token: string }) {
  const [current, setCurrent] = useState<CurrentQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getCurrentQuestion(token, controller.signal)
      .then(setCurrent)
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("We could not load the current question. Refresh this page to reconnect.");
        }
      });
    return () => controller.abort();
  }, [token]);

  async function advance(result?: import("./public-api").AnswerResult) {
    setError("");
    if (result) {
      setCurrent({ completed: result.completed, state: result.state, progress: result.progress, question: result.nextQuestion });
      return;
    }
    try {
      setCurrent(await getCurrentQuestion(token));
    } catch {
      setError("Your submission was received, but the next question could not be loaded. Refresh to reconnect.");
    }
  }

  async function submit() {
    if (!current?.question || !answer.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await submitCandidateAnswer(token, current.question.id, answer);
      setAnswer("");
      setCurrent({ completed: result.completed, state: result.state, progress: result.progress, question: result.nextQuestion });
    } catch {
      setError("Your answer was not submitted. It remains in this browser; please try again.");
    } finally { setBusy(false); }
  }

  if (error && !current) return <p role="alert" className="mt-7 border border-[#e0cdbd] bg-[#fff8f0] p-4 text-sm text-[#a13d25]">{error}</p>;
  if (!current) return <div className="mt-8 flex items-center gap-2 text-sm text-[#716d65]" role="status"><LoaderCircle className="size-4 animate-spin" /> Loading question</div>;
  if (current.completed || !current.question) return <div className="mt-8 border border-[#9ab6aa] bg-[#edf5f1] p-5"><p className="font-medium text-[#245441]">All responses have been submitted.</p><p className="mt-2 text-sm text-[#527064]">Your interview is now queued for evaluation.</p></div>;
  const number = current.progress.answeredQuestions + 1;
  const question = current.question;
  return <div className="mt-8 border-t border-[#ded9d0] pt-7"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a13d25]">Question {number} of {current.progress.totalQuestions}</p><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#716d65]">{question.type.replaceAll("_", " ")}</span></div><h2 className="mt-4 text-xl font-semibold leading-8">{question.prompt}</h2>{question.type === "CODING" ? <CodingWorkspace key={question.id} token={token} questionId={question.id} onSubmitted={advance} /> : question.type === "SYSTEM_DESIGN" ? <SystemDesignWorkspace key={question.id} token={token} questionId={question.id} onSubmitted={advance} /> : <><label className="mt-6 grid gap-2 text-sm font-medium" htmlFor="candidate-answer">Your response<textarea id="candidate-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={8} maxLength={50000} disabled={busy} className="border border-[#bdb7ad] bg-[#fff] p-4 font-normal leading-6 outline-none focus:border-[#2f6d55] focus:ring-2 focus:ring-[#2f6d55]/20" placeholder="Explain your approach, assumptions, and trade-offs." /></label><div className="mt-2 flex justify-between text-xs text-[#716d65]"><span>Your response is saved only when submitted.</span><span>{answer.length.toLocaleString()} / 50,000</span></div>{error ? <p role="alert" className="mt-4 text-sm text-[#a13d25]">{error}</p> : null}<button type="button" onClick={submit} disabled={busy || !answer.trim()} className="mt-6 flex h-12 items-center justify-center gap-2 bg-[#d94f28] px-6 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#bd3e1d] disabled:cursor-not-allowed disabled:bg-[#b9b3aa]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}{busy ? "Submitting" : "Submit response"}</button></>}{question.type === "CODING" && error ? <p role="alert" className="mt-4 text-sm text-[#a13d25]">{error}</p> : null}</div>;
}

function SessionView({ invitation, token }: { invitation: CandidateInvitation; token: string }) {
  const session = sessionFor(invitation);
  const status = normalizedStatus(session.status);
  const progress = session.progress;
  const validProgress = progress && progress.totalQuestions > 0;
  const percentage = validProgress ? Math.min(100, Math.max(0, Math.round((progress.answeredQuestions / progress.totalQuestions) * 100))) : 0;

  return (
    <InvitationShell>
      <IntegrityMonitor token={token} active />
      <div className="grid w-full gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="border border-[#d8d2c7] bg-white p-7 shadow-[8px_8px_0_#ded9d0] sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#2f6d55]">Session established</p>
            <span className="border border-[#9ab6aa] bg-[#edf5f1] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#245441]">{formatStatus(status)}</span>
          </div>
          <h1 className="mt-7 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">Your interview session is ready.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#625e57]">Answer each question in sequence. Your submitted responses and progress are stored securely, so this invitation can reconnect the session after a refresh.</p>

          <InterviewQuestionPanel token={token} />

          <div className="mt-9 border-t border-[#ded9d0] pt-7" aria-label="Interview progress">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#716d65]">Progress</p>
                <p className="mt-2 text-sm font-medium">{validProgress ? `${progress.answeredQuestions} of ${progress.totalQuestions} questions answered` : "No question progress reported"}</p>
              </div>
              {validProgress ? <span className="font-mono text-sm font-bold">{percentage}%</span> : null}
            </div>
            <div className="mt-4 h-2 overflow-hidden bg-[#e3dfd7]" aria-hidden="true">
              <div className="h-full bg-[#2f6d55]" style={{ width: `${percentage}%` }} />
            </div>
            {formatDate(session.startedAt) ? <p className="mt-4 text-xs text-[#716d65]">Started {formatDate(session.startedAt)}</p> : null}
          </div>

          <div className="mt-8 flex gap-3 border border-[#e0cdbd] bg-[#fff8f0] p-4 text-sm leading-6 text-[#655244]">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#a9582f]" aria-hidden="true" />
            <p>You can safely refresh or return with the original invitation link. Only submitted responses are restored.</p>
          </div>
          <div className="mt-4 flex gap-3 border border-[#cbd6de] bg-[#f2f6f8] p-4 text-sm leading-6 text-[#40515d]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#456879]" aria-hidden="true" />
            <p>Integrity monitoring records tab visibility, paste metadata such as data type and target, and out-of-window inactivity intervals. Clipboard contents are never collected. Signals support review and are not automatic judgments.</p>
          </div>
        </section>
        <Summary invitation={invitation} />
      </div>
    </InvitationShell>
  );
}

function ReadyView({
  invitation,
  onStart,
  starting,
  startError,
}: {
  invitation: CandidateInvitation;
  onStart: () => void;
  starting: boolean;
  startError: string;
}) {
  const [consented, setConsented] = useState(false);
  const expiry = formatDate(invitation.expiresAt);

  return (
    <InvitationShell>
      <div className="grid w-full gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="border border-[#d8d2c7] bg-white p-7 shadow-[8px_8px_0_#ded9d0] sm:p-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a13d25]">Interview invitation</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">A calm space to do your best work.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#625e57]">Welcome, {invitation.candidate.firstName || "candidate"}. Review the details, find a quiet place, and begin when you are ready.</p>

          <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Before you begin">
            {["Set aside uninterrupted time", "Use a stable internet connection", "Answer in your own words"].map((instruction, index) => (
              <li key={instruction} className="border-t border-[#d8d2c7] pt-3 text-xs leading-5 text-[#625e57]"><span className="mr-2 font-mono text-[10px] font-bold text-[#a13d25]">0{index + 1}</span>{instruction}</li>
            ))}
          </ol>

          <div className="mt-9 border-t border-[#ded9d0] pt-7">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#48453f]">
              <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="peer absolute size-5 appearance-none border border-[#8f8a81] bg-white checked:border-[#2f6d55] checked:bg-[#2f6d55] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#c54b2c]" />
                <Check className="pointer-events-none size-3.5 text-white opacity-0 peer-checked:opacity-100" aria-hidden="true" />
              </span>
              <span>I consent to participate in this interview and understand that my responses and integrity signals (tab visibility, paste metadata without clipboard contents, and inactivity intervals) will be shared with {invitation.organization.name} for hiring evaluation.</span>
            </label>
            {startError ? <p className="mt-4 text-sm text-[#a13d25]" role="alert">{startError}</p> : null}
            <button type="button" onClick={onStart} disabled={!consented || starting} className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-[#d94f28] px-5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#bd3e1d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c54b2c] disabled:cursor-not-allowed disabled:bg-[#b9b3aa] sm:w-auto">
              {starting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              {starting ? "Starting interview" : "Start interview"}
            </button>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#716d65]">
              <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" /> {invitation.assessment.durationMins} minutes</span>
              {invitation.job.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" /> {invitation.job.location}</span> : null}
              {expiry ? <span>Link valid until {expiry}</span> : null}
            </div>
          </div>
        </section>
        <Summary invitation={invitation} />
      </div>
    </InvitationShell>
  );
}

export function CandidateInvitationScreen() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [retryKey, setRetryKey] = useState(0);
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getCandidateInvitation(token, controller.signal)
      .then((invitation) => {
        if (invitationHasExpired(invitation)) setView({ kind: "expired" });
        else setView({ kind: "ready", invitation });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof PublicInvitationError && error.status === 410) setView({ kind: "expired" });
        else if (error instanceof PublicInvitationError && error.status === 404) setView({ kind: "invalid" });
        else setView({ kind: "error" });
      });
    return () => controller.abort();
  }, [token, retryKey]);

  if (view.kind === "loading") return <LoadingView />;
  if (view.kind !== "ready") return <MessageView kind={view.kind} onRetry={() => {
    setView({ kind: "loading" });
    setRetryKey((value) => value + 1);
  }} />;

  const sessionStatus = normalizedStatus(sessionFor(view.invitation).status);
  if (terminalStatuses.has(sessionStatus)) return <CompletedView invitation={view.invitation} />;
  if (sessionStatus !== "INVITED") return <SessionView invitation={view.invitation} token={token} />;

  const start = async () => {
    setStarting(true);
    setStartError("");
    try {
      await startCandidateInterview(token);
      const invitation = await getCandidateInvitation(token);
      setView(invitationHasExpired(invitation) ? { kind: "expired" } : { kind: "ready", invitation });
    } catch (error) {
      if (error instanceof PublicInvitationError && error.status === 410) setView({ kind: "expired" });
      else if (error instanceof PublicInvitationError && error.status === 409) {
        try {
          const invitation = await getCandidateInvitation(token);
          setView({ kind: "ready", invitation });
        } catch {
          setStartError("We could not confirm the current session state. Please try again.");
        }
      } else setStartError("The interview could not be started. Nothing was submitted; please try again.");
    } finally {
      setStarting(false);
    }
  };

  return <ReadyView invitation={view.invitation} onStart={start} starting={starting} startError={startError} />;
}
