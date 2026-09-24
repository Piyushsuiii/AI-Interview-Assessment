"use client";

import { useEffect, useState, type FormEvent } from "react";
import { candidateApiRequest, getErrorMessage, type CandidateAccount } from "@/lib/api";

export function CandidateProfile() {
  const [profile, setProfile] = useState<CandidateAccount | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { candidateApiRequest<CandidateAccount>("/candidate/portal/profile").then(setProfile).catch((requestError) => setError(getErrorMessage(requestError))); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await candidateApiRequest<CandidateAccount>("/candidate/portal/profile", { method: "PATCH", body: JSON.stringify({ firstName: form.get("firstName") || null, lastName: form.get("lastName") || null, phone: form.get("phone") || null, privacyConsent: form.get("privacyConsent") === "on" ? true : undefined }) });
      setProfile(updated); setMessage("Profile updated.");
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }

  if (!profile) return <p className="text-sm text-[#625e56]">{error || "Loading profile..."}</p>;
  return <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d64a22]">Personal details</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">A profile you control.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-[#625e56]">These details belong to your candidate account. Your application email is verified and cannot be changed here.</p></div>
    <form onSubmit={submit} className="border border-[#c9c3b7] bg-[#f5f1e9] p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2">{[{ name: "firstName", label: "First name", value: profile.firstName }, { name: "lastName", label: "Last name", value: profile.lastName }].map((field) => <label key={field.name} className="text-sm"><span className="font-mono text-[9px] uppercase tracking-widest text-[#777168]">{field.label}</span><input name={field.name} defaultValue={field.value ?? ""} className="mt-2 h-11 w-full border border-[#bdb7ac] bg-white px-3 outline-none focus:border-[#d64a22]" /></label>)}</div>
      <label className="mt-5 block text-sm"><span className="font-mono text-[9px] uppercase tracking-widest text-[#777168]">Verified email</span><input value={profile.email} disabled className="mt-2 h-11 w-full border border-[#d4cfc5] bg-[#ebe7de] px-3 text-[#777168]" /></label>
      <label className="mt-5 block text-sm"><span className="font-mono text-[9px] uppercase tracking-widest text-[#777168]">Phone</span><input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} className="mt-2 h-11 w-full border border-[#bdb7ac] bg-white px-3 outline-none focus:border-[#d64a22]" /></label>
      {!profile.privacyConsentAt ? <label className="mt-6 flex items-start gap-3 border border-[#d4cfc5] p-4 text-xs leading-5 text-[#625e56]"><input name="privacyConsent" type="checkbox" className="mt-1" /><span>I acknowledge that my profile and interview responses are processed to manage my applications.</span></label> : <p className="mt-6 text-xs text-[#777168]">Privacy acknowledgement recorded.</p>}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}{message ? <p className="mt-4 text-sm text-green-800">{message}</p> : null}
      <button disabled={busy} className="mt-6 bg-[#171714] px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-white disabled:opacity-50">{busy ? "Saving..." : "Save profile"}</button>
    </form></div>;
}
