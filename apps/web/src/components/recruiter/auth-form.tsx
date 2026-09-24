"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest, getErrorMessage, type Session } from "@/lib/api";
import { Input, SubmitButton } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "login";
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const next = searchParams.get("next");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    if (!isLogin && (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || password.length < 10)) {
      setError("Password must be at least 10 characters and include upper and lowercase letters and a number.");
      setBusy(false);
      return;
    }
    const body = isLogin
      ? { email: formData.get("email"), password }
      : { firstName: formData.get("firstName"), lastName: formData.get("lastName"), organizationName: formData.get("organizationName"), email: formData.get("email"), password };
    try {
      await apiRequest(isLogin ? "/auth/login" : "/auth/signup", { method: "POST", body: JSON.stringify(body) });
      await apiRequest<Session>("/auth/me");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <a href={`${apiUrl}/auth/google`} className="flex h-11 items-center justify-center border border-[#3b3b3b] bg-[#1b1b1b] text-sm font-medium text-[#e9e6e0] transition hover:border-[#666] hover:bg-[#222]">Continue with Google</a>
      <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-[#303030]" /><span className="font-mono text-[9px] uppercase tracking-widest text-[#666]">or use email</span><span className="h-px flex-1 bg-[#303030]" /></div>
      {!isLogin ? <><div className="grid gap-5 sm:grid-cols-2"><Input name="firstName" label="First name" autoComplete="given-name" required /><Input name="lastName" label="Last name" autoComplete="family-name" required /></div><Input name="organizationName" label="Organization" autoComplete="organization" placeholder="Acme Inc." required /></> : null}
      <Input name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" required />
      <Input name="password" label="Password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? 1 : 10} hint={!isLogin ? "10+ characters with upper and lowercase letters and a number." : undefined} required />
      {isLogin ? <div className="text-right"><Link className="text-xs text-[#aaa6a0] underline decoration-[#ff4d1c] underline-offset-4 hover:text-[#f0ede8]" href="/forgot-password">Forgot password?</Link></div> : null}
      {error ? <p role="alert" className="border border-red-950 bg-red-950/20 px-3 py-2 text-sm text-red-300">{error}</p> : null}
      <SubmitButton busy={busy}>{isLogin ? "Enter workspace" : "Create account"}</SubmitButton>
      <p className="text-center text-sm text-[#888]">{isLogin ? "New to AI Hiring?" : "Already have an account?"} <Link className="text-[#f0ede8] underline decoration-[#ff4d1c] underline-offset-4" href={`${isLogin ? "/signup" : "/login"}${next?.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : ""}`}>{isLogin ? "Create an account" : "Sign in"}</Link></p>
      {!isLogin ? <p className="text-center text-xs text-[#777]">Need a new verification email? <Link className="text-[#aaa6a0] underline underline-offset-4" href="/verify-email">Request one</Link></p> : null}
    </form>
  );
}
