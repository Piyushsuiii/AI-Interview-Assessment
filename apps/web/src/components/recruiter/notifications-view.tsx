"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, ShieldAlert } from "lucide-react";
import { apiRequest, getErrorMessage, type Notification } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, PageSkeleton } from "./ui";

type NotificationPage = { items: Notification[]; pagination: { page: number; limit: number; total: number; pages: number } };

export function NotificationsView() {
  const { organization, refreshNotifications } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = `${organizationId}:${page}:${unreadOnly}:${retry}`;
  const [state, setState] = useState<{ key: string; data: NotificationPage | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<NotificationPage>(`/organizations/${organizationId}/notifications?page=${page}&limit=20&unread=${unreadOnly}`, {}, organizationId)
      .then((data) => { if (active) setState({ key, data, error: "" }); })
      .catch((error) => { if (active) setState({ key, data: null, error: getErrorMessage(error) }); });
    return () => { active = false; };
  }, [key, organizationId, page, unreadOnly]);

  async function markRead(notification: Notification) {
    if (notification.readAt) return;
    try {
      await apiRequest(`/organizations/${organizationId}/notifications/${notification.id}/read`, { method: "PATCH" }, organizationId);
      setState((current) => current.data ? { ...current, data: { ...current.data, items: current.data.items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item) } } : current);
      refreshNotifications();
    } catch (error) {
      setState((current) => ({ ...current, error: getErrorMessage(error) }));
    }
  }

  async function markAllRead() {
    try {
      await apiRequest(`/organizations/${organizationId}/notifications/read-all`, { method: "PATCH" }, organizationId);
      if (unreadOnly) setRetry((value) => value + 1);
      else setState((current) => current.data ? { ...current, data: { ...current.data, items: current.data.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) } } : current);
      refreshNotifications();
    } catch (error) {
      setState((current) => ({ ...current, error: getErrorMessage(error) }));
    }
  }

  if (!organization) return <EmptyState title="No organization available" description="Select an organization to view notifications." />;
  if (state.key !== key) return <PageSkeleton />;
  if (state.error || !state.data) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;
  const { items, pagination } = state.data;

  return <div className="space-y-7">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">Activity inbox</p><h1 className="mt-2 text-3xl font-semibold">Notifications</h1><p className="mt-2 text-sm text-[#8e8a84]">Important events for {organization.name}.</p></div>
      <button type="button" onClick={markAllRead} disabled={!items.some((item) => !item.readAt)} className="flex h-10 items-center justify-center gap-2 border border-[#3a3a3a] px-4 font-mono text-xs uppercase tracking-wider disabled:opacity-40"><Check className="size-4" />Mark all read</button>
    </header>
    <div className="flex gap-2" role="group" aria-label="Notification filter">
      {[false, true].map((value) => <button key={String(value)} type="button" onClick={() => { setUnreadOnly(value); setPage(1); }} className={`border px-4 py-2 text-sm ${unreadOnly === value ? "border-[#ff4d1c] bg-[#ff4d1c]/10 text-white" : "border-[#333] text-[#8e8a84]"}`}>{value ? "Unread" : "All"}</button>)}
    </div>
    {!items.length ? <EmptyState title={unreadOnly ? "You're all caught up" : "No notifications yet"} description={unreadOnly ? "There are no unread updates for this organization." : "Important hiring activity will appear here."} /> : <section className="divide-y divide-[#2c2c2c] border border-[#303030] bg-[#171717]">
      {items.map((notification) => <article key={notification.id} className={`flex gap-4 p-4 sm:p-5 ${notification.readAt ? "opacity-65" : "bg-[#1b1b1b]"}`}>
        <span className={`mt-1 grid size-9 shrink-0 place-items-center ${notification.type === "INTEGRITY_ALERT" ? "bg-amber-500/15 text-amber-400" : "bg-[#ff4d1c]/15 text-[#ff4d1c]"}`}>{notification.type === "INTEGRITY_ALERT" ? <ShieldAlert className="size-4" /> : <Bell className="size-4" />}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-medium text-[#f0ede8]">{notification.title}</h2><time className="font-mono text-[10px] uppercase tracking-wider text-[#777]">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></div><p className="mt-1 text-sm leading-6 text-[#aaa6a0]">{notification.message}</p><div className="mt-3 flex items-center gap-4">{notification.href ? <Link href={notification.href} onClick={() => void markRead(notification)} className="font-mono text-[10px] uppercase tracking-wider text-[#ff6b42] hover:text-white">View details</Link> : null}{!notification.readAt ? <button type="button" onClick={() => void markRead(notification)} className="font-mono text-[10px] uppercase tracking-wider text-[#8e8a84] hover:text-white">Mark read</button> : null}</div></div>
      </article>)}
    </section>}
    {pagination.pages > 1 ? <nav className="flex items-center justify-between" aria-label="Notification pages"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="border border-[#3a3a3a] px-4 py-2 text-xs disabled:opacity-40">Previous</button><span className="text-xs text-[#777]">Page {page} of {pagination.pages}</span><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="border border-[#3a3a3a] px-4 py-2 text-xs disabled:opacity-40">Next</button></nav> : null}
  </div>;
}
