"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleX, LoaderCircle, Play, Send } from "lucide-react";
import {
  getCodingChallenge,
  getCodingExecution,
  runCandidateCode,
  submitCandidateCode,
  submitCandidateAnswer,
  type AnswerResult,
  type CodingChallenge,
  type CodingExecution,
} from "./public-api";

const terminalStatuses = new Set(["COMPLETED", "SUCCEEDED", "FAILED", "ERROR", "TIMEOUT", "CANCELLED"]);

function statusOf(execution: CodingExecution) {
  return execution.status.toUpperCase();
}

function draftKey(token: string, questionId: string) {
  return `candidate-coding:${token.slice(-12)}:${questionId}`;
}

export function CodingWorkspace({
  token,
  questionId,
  onSubmitted,
}: {
  token: string;
  questionId: string;
  onSubmitted: (result?: AnswerResult) => Promise<void>;
}) {
  const [challenge, setChallenge] = useState<CodingChallenge | null>(null);
  const [language, setLanguage] = useState("");
  const [code, setCode] = useState("");
  const [execution, setExecution] = useState<CodingExecution | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const pollController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getCodingChallenge(token, questionId, controller.signal)
      .then((data) => {
        setChallenge(data);
        const saved = window.localStorage.getItem(draftKey(token, questionId));
        let draft: { language?: string; code?: string } = {};
        try { draft = saved ? JSON.parse(saved) : {}; } catch { /* Ignore an invalid local draft. */ }
        const selected = data.languages.some((item) => item.id === draft.language)
          ? draft.language!
          : data.languages[0]?.id ?? "";
        const languageStarter = data.languages.find((item) => item.id === selected)?.starterCode;
        setLanguage(selected);
        setCode(draft.code ?? languageStarter ?? "");
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("The coding challenge could not be loaded. Check your connection and try again.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [questionId, token]);

  useEffect(() => {
    if (!challenge) return;
    window.localStorage.setItem(draftKey(token, questionId), JSON.stringify({ language, code }));
  }, [challenge, code, language, questionId, token]);

  useEffect(() => () => pollController.current?.abort(), []);

  async function poll(initial: CodingExecution) {
    setExecution(initial);
    if (terminalStatuses.has(statusOf(initial))) return initial;
    const controller = new AbortController();
    pollController.current?.abort();
    pollController.current = controller;
    let latest = initial;
    for (let attempt = 0; attempt < 120 && !terminalStatuses.has(statusOf(latest)); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      latest = await getCodingExecution(token, questionId, initial.id, controller.signal);
      setExecution(latest);
    }
    return latest;
  }

  async function run() {
    if (!language || !code.trim()) return;
    setAction("run");
    setError("");
    try {
      await poll(await runCandidateCode(token, questionId, language, code));
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError("The run could not be completed. Your code is still saved in this browser.");
      }
    } finally {
      setAction(null);
    }
  }

  async function submit() {
    if (!language || !code.trim()) return;
    setAction("submit");
    setError("");
    try {
      const result = await submitCandidateCode(token, questionId, language, code, explanation);
      await poll(result);
      const progression = await submitCandidateAnswer(
        token,
        questionId,
        explanation.trim() || "[coding solution submitted]",
      );
      window.localStorage.removeItem(draftKey(token, questionId));
      await onSubmitted(progression);
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError("Your solution was not submitted. It remains saved in this browser; please try again.");
      }
    } finally {
      setAction(null);
    }
  }

  if (loading) return <div className="mt-6 flex items-center gap-2 text-sm text-[#716d65]" role="status"><LoaderCircle className="size-4 animate-spin" /> Loading coding environment</div>;
  if (!challenge) return <div className="mt-6"><p role="alert" className="text-sm text-[#a13d25]">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 border border-[#171713] px-4 py-2 font-mono text-xs font-bold uppercase">Reconnect</button></div>;

  return (
    <div className="mt-6 grid gap-5">
      {challenge.title || challenge.description ? <section className="border-l-2 border-[#2f6d55] pl-4"><h3 className="font-semibold">{challenge.title}</h3>{challenge.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#625e57]">{challenge.description}</p> : null}<p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#716d65]">{challenge.timeLimitMs ? `${challenge.timeLimitMs} ms` : ""}{challenge.timeLimitMs && challenge.memoryLimitMb ? " / " : ""}{challenge.memoryLimitMb ? `${challenge.memoryLimitMb} MB` : ""}</p></section> : null}
      <div className="overflow-hidden border border-[#292923] bg-[#171713] text-[#f5f2ea]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3b3a33] px-4 py-3">
          <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#aaa69c]">
            Language
            <select value={language} onChange={(event) => {
              const next = event.target.value;
              setLanguage(next);
              if (!code.trim()) setCode(challenge.languages.find((item) => item.id === next)?.starterCode ?? "");
            }} disabled={Boolean(action)} className="border border-[#57554c] bg-[#24241f] px-3 py-2 text-xs text-white outline-none focus:border-[#e97850]">
              {challenge.languages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#817e75]">Executed securely on the interview server</span>
        </div>
        {challenge.languages.length ? (
          <textarea aria-label="Code editor" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            const target = event.currentTarget;
            const next = `${code.slice(0, target.selectionStart)}  ${code.slice(target.selectionEnd)}`;
            const cursor = target.selectionStart + 2;
            setCode(next);
            requestAnimationFrame(() => target.setSelectionRange(cursor, cursor));
          }} spellCheck={false} disabled={Boolean(action)} className="min-h-80 w-full resize-y bg-[#171713] p-5 font-mono text-[13px] leading-6 text-[#f5f2ea] outline-none focus:ring-2 focus:ring-inset focus:ring-[#e97850]" />
        ) : <p role="alert" className="p-5 text-sm text-[#ffb49d]">No execution languages are available for this challenge.</p>}
      </div>

      {execution ? <ExecutionResult execution={execution} /> : null}
      <label className="grid gap-2 text-sm font-medium">Solution explanation<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={4} maxLength={10000} disabled={Boolean(action)} className="border border-[#bdb7ad] bg-white p-3 font-normal leading-6 outline-none focus:border-[#2f6d55]" placeholder="Explain the algorithm, complexity, and edge cases." /></label>
      {error ? <p role="alert" className="text-sm text-[#a13d25]">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={run} disabled={Boolean(action) || !language || !code.trim()} className="flex h-11 items-center gap-2 border border-[#171713] px-5 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40">{action === "run" ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} Run tests</button>
        <button type="button" onClick={submit} disabled={Boolean(action) || !language || !code.trim()} className="flex h-11 items-center gap-2 bg-[#d94f28] px-5 font-mono text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-[#b9b3aa]">{action === "submit" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Submit solution</button>
      </div>
    </div>
  );
}

function ExecutionResult({ execution }: { execution: CodingExecution }) {
  const pending = !terminalStatuses.has(statusOf(execution));
  return (
    <section className="border border-[#d8d2c7] bg-[#f7f5f0] p-4" aria-live="polite" aria-label="Execution result">
      <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
        {pending ? <LoaderCircle className="size-4 animate-spin text-[#a9582f]" /> : statusOf(execution) === "SUCCEEDED" || statusOf(execution) === "COMPLETED" ? <CheckCircle2 className="size-4 text-[#2f6d55]" /> : <CircleX className="size-4 text-[#a13d25]" />}
        {execution.status}
      </div>
      {execution.tests?.length ? <ul className="mt-4 grid gap-2">{execution.tests.map((test, index) => <li key={`${test.name ?? "test"}-${index}`} className="flex gap-2 text-sm">{test.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2f6d55]" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-[#a13d25]" />}<span><strong>{test.name || `Test ${index + 1}`}</strong>{test.output ? <span className="mt-1 block whitespace-pre-wrap font-mono text-xs text-[#625e57]">{test.output}</span> : null}{test.error ? <span className="mt-1 block whitespace-pre-wrap font-mono text-xs text-[#a13d25]">{test.error}</span> : null}</span></li>)}</ul> : null}
      {execution.output ? <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap border-t border-[#ded9d0] pt-3 text-xs">{execution.output}</pre> : null}
      {execution.error ? <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap border-t border-[#e0cdbd] pt-3 text-xs text-[#a13d25]">{execution.error}</pre> : null}
      {execution.explanation ? <p className="mt-4 border-t border-[#ded9d0] pt-3 text-sm leading-6 text-[#625e57]">{execution.explanation}</p> : null}
    </section>
  );
}
