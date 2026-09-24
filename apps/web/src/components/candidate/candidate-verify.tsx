"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { candidateApiRequest, getErrorMessage } from "@/lib/api";

export function CandidateVerify() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState(token ? "" : "This sign-in link is incomplete.");

  useEffect(() => {
    if (!token) return;
    let active = true;
    candidateApiRequest("/candidate/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => { if (active) { router.replace("/candidate"); router.refresh(); } })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); });
    return () => { active = false; };
  }, [router, token]);

  return <div className="border border-[#cac5ba] bg-[#f3efe7] p-10 text-[#171714]">
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d64a22]">Secure sign in</p>
    <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{error ? "Link unavailable" : "Verifying your link..."}</h1>
    <p className="mt-3 text-sm leading-6 text-[#625e56]">{error || "Please keep this page open. You will be redirected automatically."}</p>
    {error ? <Link href="/candidate/login" className="mt-7 inline-block bg-[#171714] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white">Request a new link</Link> : <div className="mt-8 h-1 overflow-hidden bg-[#ddd7cd]"><span className="block h-full w-1/2 animate-pulse bg-[#d64a22]" /></div>}
  </div>;
}
