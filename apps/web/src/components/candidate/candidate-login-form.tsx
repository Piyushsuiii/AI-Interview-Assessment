"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { candidateApiRequest, getErrorMessage } from "@/lib/api";

export function CandidateLoginForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await candidateApiRequest<{ message: string; previewUrl?: string }>("/candidate/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email") }),
      });
      setPreviewUrl(result.previewUrl ?? "");
      setSent(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (sent) return (
    <div className="border border-[#cac5ba] bg-[#f3efe7] p-7 text-[#171714] sm:p-10">
      <CheckCircle2 className="size-8 text-[#d64a22]" />
      <h1 className="mt-7 text-3xl font-semibold tracking-[-0.04em]">Check your inbox.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#625e56]">If your email is linked to an application, we sent a secure sign-in link. It expires in 15 minutes and works once.</p>
      {previewUrl ? <a className="mt-7 inline-flex items-center gap-2 bg-[#171714] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white" href={previewUrl}>Open development link <ArrowRight className="size-4" /></a> : null}
      <button className="mt-7 block font-mono text-[11px] uppercase tracking-widest text-[#6f6a61] underline underline-offset-4" type="button" onClick={() => setSent(false)}>Use another email</button>
    </div>
  );

  return (
    <form onSubmit={submit} className="border border-[#cac5ba] bg-[#f3efe7] p-7 text-[#171714] sm:p-10">
      <div className="flex size-11 items-center justify-center border border-[#d4cfc5] bg-white"><Mail className="size-5 text-[#d64a22]" /></div>
      <h1 className="mt-7 text-3xl font-semibold tracking-[-0.04em]">Your application desk</h1>
      <p className="mt-3 text-sm leading-6 text-[#625e56]">No password to remember. Enter the email used on your job application.</p>
      <label className="mt-8 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#777168]" htmlFor="candidate-email">Application email</label>
      <input id="candidate-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="mt-2 h-12 w-full border border-[#bab4aa] bg-white px-4 text-sm outline-none transition focus:border-[#d64a22]" />
      {error ? <p role="alert" className="mt-4 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#d64a22] font-mono text-xs font-bold uppercase tracking-widest text-white transition hover:bg-[#b93b18] disabled:opacity-60">{busy ? "Sending link..." : "Send secure link"}<ArrowRight className="size-4" /></button>
      <p className="mt-7 text-xs leading-5 text-[#777168]">Only emails already attached to an application can sign in. Recruiters use a separate workspace. <Link href="/login" className="underline underline-offset-4">Recruiter sign in</Link></p>
    </form>
  );
}
