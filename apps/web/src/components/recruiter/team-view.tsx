"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MailPlus, Trash2 } from "lucide-react";
import { apiRequest, getErrorMessage, type TeamInvite, type TeamMember } from "@/lib/api";
import { useRecruiterApp } from "./app-shell";
import { EmptyState, ErrorState, Input, PageSkeleton, Select, Table } from "./ui";

const roles = ["ADMIN", "HIRING_MANAGER", "RECRUITER", "INTERVIEWER", "VIEWER"];
const roleLabel = (role: string) => role.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export function TeamView() {
  const { organization, session } = useRecruiterApp();
  const organizationId = organization?.id ?? "";
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const [state, setState] = useState<{ key: string; members: TeamMember[]; invites: TeamInvite[]; error: string }>({ key: "", members: [], invites: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<{ members: TeamMember[]; invites: TeamInvite[] }>(`/organizations/${organizationId}/team`, {}, organizationId)
      .then((data) => active && setState({ key: organizationId, ...data, error: "" }))
      .catch((error) => active && setState({ key: organizationId, members: [], invites: [], error: getErrorMessage(error) }));
    return () => { active = false; };
  }, [organizationId, retry]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setActionError("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      await apiRequest(`/organizations/${organizationId}/invites`, { method: "POST", body: JSON.stringify({ email: data.get("email"), role: data.get("role") }) }, organizationId);
      form.reset(); setRetry((value) => value + 1);
    } catch (error) { setActionError(getErrorMessage(error)); } finally { setBusy(false); }
  }

  async function action(path: string, init: RequestInit) {
    setActionError("");
    try { await apiRequest(path, init, organizationId); setRetry((value) => value + 1); }
    catch (error) { setActionError(getErrorMessage(error)); }
  }

  if (!organization) return <EmptyState title="No organization available" description="Select an organization before managing a team." />;
  if (state.key !== organizationId) return <PageSkeleton />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;

  return <div className="space-y-8">
    <header><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">{organization.name}</p><h1 className="mt-2 text-3xl font-semibold">Organization team</h1><p className="mt-2 text-sm text-[#8e8a84]">Members and pending invitations for this workspace.</p></header>
    {canManage ? <form onSubmit={invite} className="grid gap-4 border border-[#303030] bg-[#171717] p-5 md:grid-cols-[1fr_220px_auto] md:items-end"><Input name="email" type="email" label="Invite by email" required /><Select name="role" label="Role">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</Select><button disabled={busy} className="btn-orange flex h-11 items-center justify-center gap-2 px-5 text-xs disabled:opacity-50"><MailPlus className="size-4" />{busy ? "Sending" : "Send invite"}</button></form> : null}
    {actionError ? <p role="alert" className="border border-red-950 bg-red-950/20 p-3 text-sm text-red-300">{actionError}</p> : null}
    <section><h2 className="mb-3 text-lg font-semibold">Members <span className="ml-2 font-mono text-xs text-[#777]">{state.members.length}</span></h2><div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table><thead><tr className="border-b border-[#303030] font-mono text-[9px] uppercase tracking-widest text-[#777]"><th className="p-4">Member</th><th className="p-4">Role</th><th className="p-4">Joined</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{state.members.map((member) => <tr key={member.id} className="border-b border-[#292929] last:border-0"><td className="p-4"><p>{[member.user.firstName, member.user.lastName].filter(Boolean).join(" ") || member.user.email}</p><p className="text-xs text-[#777]">{member.user.email}{member.user.id === session.user.id ? " (you)" : ""}</p></td><td className="p-4">{canManage && !(member.role === "OWNER" && organization.role !== "OWNER") ? <select aria-label={`Role for ${member.user.email}`} value={member.role} onChange={(event) => action(`/organizations/${organizationId}/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) })} className="border border-[#393939] bg-[#151515] px-2 py-1.5 text-xs">{(organization.role === "OWNER" ? ["OWNER", ...roles] : roles).map((role) => <option key={role}>{role}</option>)}</select> : roleLabel(member.role)}</td><td className="p-4 text-[#888]">{new Date(member.createdAt).toLocaleDateString()}</td><td className="p-4 text-right">{canManage && member.user.id !== session.user.id ? <button type="button" aria-label={`Remove ${member.user.email}`} onClick={() => action(`/organizations/${organizationId}/members/${member.id}`, { method: "DELETE" })} className="text-[#888] hover:text-red-400"><Trash2 className="size-4" /></button> : null}</td></tr>)}</tbody></Table></div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Pending invitations</h2>{!state.invites.length ? <EmptyState title="No pending invitations" description="New invitations will appear here until accepted or expired." /> : <div className="overflow-x-auto border border-[#303030] bg-[#171717]"><Table><tbody>{state.invites.map((invite) => <tr key={invite.id} className="border-b border-[#292929] last:border-0"><td className="p-4">{invite.email}</td><td className="p-4">{roleLabel(invite.role)}</td><td className="p-4 text-[#888]">Expires {new Date(invite.expiresAt).toLocaleDateString()}</td><td className="p-4 text-right">{canManage ? <button type="button" onClick={() => action(`/organizations/${organizationId}/invites/${invite.id}`, { method: "DELETE" })} className="text-xs text-[#aaa] hover:text-red-400">Revoke</button> : null}</td></tr>)}</tbody></Table></div>}</section>
  </div>;
}
