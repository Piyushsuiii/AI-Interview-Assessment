"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { candidateApiRequest, getErrorMessage } from "@/lib/api";

export function CandidatePrivacy() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function downloadData() {
    setBusy("export"); setError("");
    try {
      const data = await candidateApiRequest<unknown>("/candidate/portal/privacy/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `candidate-data-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(""); }
  }

  async function requestDeletion() {
    if (!window.confirm("Request deletion of your candidate account and personal data? You will be signed out immediately.")) return;
    setBusy("delete"); setError("");
    try { await candidateApiRequest("/candidate/portal/privacy/deletion", { method: "POST" }); router.replace("/candidate/login?deletion=requested"); router.refresh(); }
    catch (requestError) { setError(getErrorMessage(requestError)); setBusy(""); }
  }

  return <div><div className="max-w-2xl"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d64a22]">Privacy controls</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">Your data, on your terms.</h1><p className="mt-4 text-sm leading-6 text-[#625e56]">Download the personal information held in your candidate account or ask us to remove it. Employer-only evaluations are not part of the candidate portal.</p></div>
    {error ? <p role="alert" className="mt-6 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    <div className="mt-10 grid gap-5 md:grid-cols-2"><section className="border border-[#c9c3b7] bg-[#f5f1e9] p-6"><Download className="size-5 text-[#d64a22]" /><h2 className="mt-8 text-xl font-semibold">Download your data</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#625e56]">Get a JSON copy of your profile, applications, interview responses, and privacy requests.</p><button disabled={Boolean(busy)} onClick={downloadData} className="mt-6 border border-[#171714] px-4 py-3 font-mono text-[10px] uppercase tracking-widest disabled:opacity-50">{busy === "export" ? "Preparing..." : "Download copy"}</button></section>
      <section className="border border-[#c9c3b7] bg-[#f5f1e9] p-6"><Trash2 className="size-5 text-[#a52d1b]" /><h2 className="mt-8 text-xl font-semibold">Delete your account</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#625e56]">Submit a deletion request. Active sessions are revoked immediately while the request is reviewed.</p><button disabled={Boolean(busy)} onClick={requestDeletion} className="mt-6 border border-[#a52d1b] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[#a52d1b] disabled:opacity-50">{busy === "delete" ? "Submitting..." : "Request deletion"}</button></section></div>
    <div className="mt-8 flex items-start gap-3 border-t border-[#c9c3b7] pt-6 text-xs leading-5 text-[#777168]"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>Candidate and recruiter sessions are isolated. Signing into this portal does not grant access to recruiter workspaces or internal hiring decisions.</p></div>
  </div>;
}
