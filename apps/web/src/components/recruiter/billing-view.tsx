"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, LoaderCircle } from "lucide-react";
import { apiRequest, getErrorMessage, type BillingSummary } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, PageSkeleton } from "./ui";

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit ? Math.min(100, used / limit * 100) : 0;
  return <article className="border border-[#303030] bg-[#191919] p-5"><div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">{label}</p><p className="mt-3 text-2xl font-semibold">{used.toLocaleString()}</p></div><span className="text-xs text-[#8e8a84]">{limit === null ? "Unlimited" : `of ${limit.toLocaleString()}`}</span></div>{limit !== null ? <div className="mt-4 h-1.5 bg-[#303030]"><div className="h-full bg-[#ff4d1c]" style={{ width: `${percent}%` }} /></div> : null}</article>;
}

export function BillingView() {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState("");
  const key = `${organizationId}:${retry}`;
  const [state, setState] = useState<{ key: string; data: BillingSummary | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!organizationId || organization?.role !== "OWNER") return;
    let active = true;
    apiRequest<BillingSummary>(`/organizations/${organizationId}/billing`, {}, organizationId)
      .then((data) => { if (active) setState({ key, data, error: "" }); })
      .catch((error) => { if (active) setState({ key, data: null, error: getErrorMessage(error) }); });
    return () => { active = false; };
  }, [key, organization?.role, organizationId]);

  async function open(path: "checkout" | "portal", plan?: string) {
    setBusy(plan ?? path);
    try {
      const result = await apiRequest<{ url: string }>(`/organizations/${organizationId}/billing/${path}`, { method: "POST", body: plan ? JSON.stringify({ plan }) : undefined }, organizationId);
      window.location.assign(result.url);
    } catch (error) {
      setState((current) => ({ ...current, error: getErrorMessage(error) }));
      setBusy("");
    }
  }

  if (!organization) return <EmptyState title="No organization available" description="Select an organization to view billing." />;
  if (organization.role !== "OWNER") return <EmptyState title="Owner access required" description="Only organization owners can view subscriptions or start billing actions." />;
  if (state.key !== key) return <PageSkeleton />;
  if (state.error || !state.data) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;
  const data = state.data;

  return <div className="space-y-8">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">Account controls</p><h1 className="mt-2 text-3xl font-semibold">Billing</h1><p className="mt-2 text-sm text-[#8e8a84]">Subscription and current-period usage for {organization.name}.</p></div>{data.subscription.canManage ? <button type="button" disabled={Boolean(busy) || !data.configured} onClick={() => void open("portal")} className="flex h-11 items-center gap-2 border border-[#444] px-5 font-mono text-xs uppercase tracking-wider disabled:opacity-40">{busy === "portal" ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Manage in Stripe</button> : null}</header>
    {!data.configured ? <div role="status" className="border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-200">Stripe billing is not configured. Your Starter plan and usage remain available, but checkout and portal actions are disabled.</div> : null}
    <section className="grid gap-5 border border-[#303030] bg-[#171717] p-5 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Current plan</p><div className="mt-3 flex flex-wrap items-center gap-3"><h2 className="text-3xl font-semibold">{data.subscription.plan}</h2><span className="border border-emerald-900 bg-emerald-950/30 px-2 py-1 font-mono text-[10px] uppercase text-emerald-300">{data.subscription.status.replaceAll("_", " ")}</span></div><p className="mt-3 text-sm text-[#8e8a84]">{data.subscription.cancelAtPeriodEnd ? "Cancels at the end of the current billing period." : "Renews according to your Stripe subscription."}</p></div><CheckCircle2 className="hidden size-10 text-[#ff4d1c] md:block" /></section>
    <section><h2 className="mb-4 text-lg font-semibold">Current usage</h2><div className="grid gap-4 md:grid-cols-3"><Usage label="Interviews" {...data.usage.interviews} /><Usage label="AI tokens" {...data.usage.aiTokens} /><Usage label="Team members" {...data.usage.teamMembers} /></div></section>
    <section><div className="mb-4"><h2 className="text-lg font-semibold">Plans</h2><p className="mt-1 text-sm text-[#777]">Checkout pricing is loaded from Stripe, never from this browser. Existing subscriptions are changed in the customer portal.</p></div><div className="grid gap-4 lg:grid-cols-3">{data.plans.map((item) => <article key={item.plan} className={`border p-5 ${item.plan === data.subscription.plan ? "border-[#ff4d1c] bg-[#ff4d1c]/5" : "border-[#303030] bg-[#171717]"}`}><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">{item.plan === data.subscription.plan ? "Current" : "Available"}</p><h3 className="mt-3 text-xl font-semibold">{item.plan}</h3><button type="button" disabled={Boolean(busy) || !data.configured || !data.subscription.canCheckout || !item.checkoutAvailable || item.plan === data.subscription.plan} onClick={() => void open("checkout", item.plan)} className="mt-6 flex h-10 w-full items-center justify-center gap-2 border border-[#444] font-mono text-xs uppercase tracking-wider disabled:opacity-35">{busy === item.plan ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}{item.plan === data.subscription.plan ? "Current plan" : data.subscription.canCheckout ? "Choose plan" : "Use billing portal"}</button></article>)}</div></section>
  </div>;
}
