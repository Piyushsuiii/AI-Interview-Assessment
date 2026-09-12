"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ScanSearch } from "lucide-react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { Input, SubmitButton } from "./ui";

type Mode = "forgot-password" | "reset-password" | "verify-email";

const content = {
  "forgot-password": {
    eyebrow: "Account recovery",
    title: "Reset your password.",
    description: "Enter your work email and we will send a secure, one-time reset link if an account exists.",
  },
  "reset-password": {
    eyebrow: "Account recovery",
    title: "Choose a new password.",
    description: "Your reset link can be used once. Completing this step signs out every existing session.",
  },
  "verify-email": {
    eyebrow: "Account security",
    title: "Verify your email.",
    description: "Confirm your work email, or request a fresh verification message if your link is missing or expired.",
  },
} satisfies Record<Mode, { eyebrow: string; title: string; description: string }>;

export function AccountActionPage({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const verifiesToken = mode === "verify-email" && Boolean(token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const copy = content[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    if (mode === "reset-password" && (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || password.length < 10)) {
      setError("Password must be at least 10 characters and include upper and lowercase letters and a number.");
      setBusy(false);
      return;
    }

    const request = mode === "forgot-password"
      ? { path: "/auth/forgot-password", body: { email: formData.get("email") } }
      : mode === "reset-password"
        ? { path: "/auth/reset-password", body: { token, password } }
        : verifiesToken
          ? { path: "/auth/verify-email", body: { token } }
          : { path: "/auth/email-verification/request", body: { email: formData.get("email") } };

    try {
      await apiRequest(request.path, { method: "POST", body: JSON.stringify(request.body) });
      setMessage(mode === "reset-password"
        ? "Password updated. All existing sessions have been signed out."
        : verifiesToken
          ? "Your email address is verified."
          : "If the account is eligible, an email is on its way.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  const missingResetToken = mode === "reset-password" && !token;

  return (
    <main className="grid min-h-screen bg-[#111] text-[#f0ede8] lg:grid-cols-[0.85fr_1.15fr]">
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-3 self-start"><span className="grid size-8 place-items-center bg-[#ff4d1c]"><ScanSearch className="size-4" /></span><span className="font-mono text-xs font-bold uppercase tracking-[0.17em]">AI Hiring</span></Link>
        <div className="my-auto w-full max-w-md py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ff4d1c]">{copy.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#8e8a84]">{copy.description}</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === "forgot-password" || (mode === "verify-email" && !verifiesToken) ? <Input name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" required /> : null}
            {mode === "reset-password" && token ? <Input name="password" label="New password" type="password" autoComplete="new-password" minLength={10} hint="10+ characters with upper and lowercase letters and a number." required /> : null}
            {missingResetToken ? <p role="alert" className="border border-red-950 bg-red-950/20 px-3 py-2 text-sm text-red-300">This reset link is incomplete. Request a new password reset email.</p> : null}
            {error ? <p role="alert" className="border border-red-950 bg-red-950/20 px-3 py-2 text-sm text-red-300">{error}</p> : null}
            {message ? <p role="status" className="border border-emerald-950 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}
            {!message && !missingResetToken ? <SubmitButton busy={busy}>{mode === "forgot-password" ? "Send reset link" : mode === "reset-password" ? "Update password" : verifiesToken ? "Verify email" : "Send verification link"}</SubmitButton> : null}
            {missingResetToken ? <Link className="btn-orange flex h-11 items-center justify-center px-5 text-xs" href="/forgot-password">Request reset link</Link> : null}
            <p className="text-center text-sm text-[#888]"><Link className="text-[#f0ede8] underline decoration-[#ff4d1c] underline-offset-4" href="/login">Return to sign in</Link></p>
          </form>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#555]">Secure by default</p>
      </section>
      <aside className="relative hidden overflow-hidden border-l border-[#2e2e2e] bg-blueprint-fine lg:flex lg:flex-col lg:justify-end lg:p-16">
        <div className="absolute right-20 top-20 size-64 border border-[#ff4d1c]/25" /><div className="absolute right-32 top-32 size-64 border border-[#444]" />
        <div className="relative max-w-lg border-l-2 border-[#ff4d1c] bg-[#151515]/90 p-8 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777]">Security principle</p>
          <p className="mt-5 text-2xl leading-snug">Short-lived links protect access without exposing account status.</p>
        </div>
      </aside>
    </main>
  );
}
