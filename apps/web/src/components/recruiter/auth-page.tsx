import Link from "next/link";
import { Suspense } from "react";
import { ScanSearch } from "lucide-react";
import { AuthForm } from "./auth-form";
import { Skeleton } from "./ui";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const login = mode === "login";
  return (
    <main className="grid min-h-screen bg-[#111] text-[#f0ede8] lg:grid-cols-[0.85fr_1.15fr]">
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-3 self-start"><span className="grid size-8 place-items-center bg-[#ff4d1c]"><ScanSearch className="size-4" /></span><span className="font-mono text-xs font-bold uppercase tracking-[0.17em]">AI Hiring</span></Link>
        <div className="my-auto w-full max-w-md py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ff4d1c]">Recruiter access</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{login ? "Welcome back." : "Build your hiring command center."}</h1>
          <p className="mt-3 text-sm leading-6 text-[#8e8a84]">{login ? "Sign in to manage requisitions and keep your hiring work moving." : "Create a secure recruiter account to start structuring your roles."}</p>
          <Suspense fallback={<div className="mt-8 space-y-5"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-11" /></div>}><AuthForm mode={mode} /></Suspense>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#555]">Evidence over instinct</p>
      </section>
      <aside className="relative hidden overflow-hidden border-l border-[#2e2e2e] bg-blueprint-fine lg:flex lg:flex-col lg:justify-end lg:p-16">
        <div className="absolute right-20 top-20 size-64 border border-[#ff4d1c]/25" /><div className="absolute right-32 top-32 size-64 border border-[#444]" />
        <div className="relative max-w-lg border-l-2 border-[#ff4d1c] bg-[#151515]/90 p-8 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777]">System principle 01</p>
          <p className="mt-5 text-2xl leading-snug">Every hiring decision should be traceable to clear, structured evidence.</p>
        </div>
      </aside>
    </main>
  );
}
