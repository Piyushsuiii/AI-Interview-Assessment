"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FileText, LayoutGrid, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ApiError, candidateApiRequest, type CandidateAccount } from "@/lib/api";

const CandidateContext = createContext<{ account: CandidateAccount } | null>(null);
export function useCandidateAccount() {
  const value = useContext(CandidateContext);
  if (!value) throw new Error("useCandidateAccount must be used inside CandidateShell");
  return value.account;
}

const navigation = [
  { href: "/candidate", label: "Applications", icon: LayoutGrid },
  { href: "/candidate/profile", label: "Profile", icon: UserRound },
  { href: "/candidate/privacy", label: "Privacy", icon: ShieldCheck },
];

export function CandidateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<CandidateAccount | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    candidateApiRequest<CandidateAccount>("/candidate/auth/me").then((result) => { if (active) setAccount(result); }).catch((requestError) => {
      if (!active) return;
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) router.replace("/candidate/login");
      else setError(requestError instanceof Error ? requestError.message : "Unable to load your portal.");
    });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await candidateApiRequest("/candidate/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/candidate/login");
    router.refresh();
  }

  if (error) return <main className="grid min-h-screen place-items-center bg-[#e9e5dc] p-6 text-[#171714]"><div><h1 className="text-2xl font-semibold">Portal unavailable</h1><p className="mt-2 text-sm text-[#625e56]">{error}</p></div></main>;
  if (!account) return <main className="min-h-screen bg-[#e9e5dc] p-8"><div className="mx-auto h-1 w-48 animate-pulse bg-[#d64a22]" /></main>;
  const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email;

  return <CandidateContext.Provider value={{ account }}><div className="min-h-screen bg-[#e9e5dc] text-[#171714]">
    <header className="border-b border-[#cbc5ba] bg-[#f5f1e9]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/candidate" className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[#171714] text-white"><FileText className="size-4" /></span><span><strong className="block text-sm">Candidate Desk</strong><span className="block font-mono text-[9px] uppercase tracking-widest text-[#777168]">AI Hiring</span></span></Link>
        <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><strong className="block text-xs">{name}</strong><span className="block text-[11px] text-[#777168]">{account.email}</span></span><button type="button" onClick={logout} className="grid size-9 place-items-center border border-[#cbc5ba]" aria-label="Sign out"><LogOut className="size-4" /></button></div>
      </div>
      <nav className="mx-auto flex max-w-6xl overflow-x-auto px-5 sm:px-8" aria-label="Candidate navigation">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-4 py-3 font-mono text-[10px] uppercase tracking-widest ${active ? "border-[#d64a22] text-[#171714]" : "border-transparent text-[#777168]"}`}><Icon className="size-3.5" />{label}</Link>; })}</nav>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
  </div></CandidateContext.Provider>;
}
