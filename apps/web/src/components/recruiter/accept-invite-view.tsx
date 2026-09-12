"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

export function AcceptInviteView() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ busy: boolean; error: string; organizationName: string }>({ busy: false, error: "", organizationName: "" });
  async function accept() {
    setState({ busy: true, error: "", organizationName: "" });
    try { const result = await apiRequest<{ organizationName: string }>("/organizations/invites/accept", { method: "POST", body: JSON.stringify({ token }) }); setState({ busy: false, error: "", organizationName: result.organizationName }); }
    catch (error) { setState({ busy: false, error: getErrorMessage(error), organizationName: "" }); }
  }
  return <div className="mx-auto max-w-xl border border-[#303030] bg-[#171717] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[#ff4d1c]">Team invitation</p><h1 className="mt-3 text-2xl font-semibold">Join an organization</h1><p className="mt-3 text-sm leading-6 text-[#999]">The invitation must match the email address on your signed-in account.</p>{state.organizationName ? <div className="mt-6"><p className="text-green-300">You joined {state.organizationName}.</p><Link href="/dashboard" className="btn-orange mt-5 inline-flex h-10 items-center px-4 text-xs">Open workspace</Link></div> : <button type="button" disabled={state.busy || token.length < 20} onClick={accept} className="btn-orange mt-6 h-11 px-5 text-xs disabled:opacity-50">{state.busy ? "Accepting" : "Accept invitation"}</button>}{state.error ? <p role="alert" className="mt-4 text-sm text-red-300">{state.error}</p> : null}</div>;
}
