"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bell, Bot, BriefcaseBusiness, ClipboardCheck, CreditCard, GitCompareArrows, LayoutDashboard, ListChecks, LogOut, Plus, ScanSearch, Settings, UserRoundCog, Users } from "lucide-react";
import { ApiError, apiRequest, type Organization, type Session } from "@/lib/api";
import { ErrorState, PageSkeleton } from "./ui";

type AppContextValue = {
  session: Session;
  organization: Organization | null;
  setOrganizationId: (id: string) => void;
  unreadNotifications: number;
  refreshNotifications: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const ORG_KEY = "recruiter-organization-id";

export function useRecruiterApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useRecruiterApp must be used inside AppShell");
  return value;
}

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/interviews", label: "Review queue", icon: ListChecks },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/billing", label: "Billing", icon: CreditCard, ownerOnly: true },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/copilot", label: "Copilot", icon: Bot },
  { href: "/team", label: "Team", icon: UserRoundCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationIdState] = useState("");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationRefresh, setNotificationRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<Session>("/auth/me").then((current) => {
      if (!active) return;
      setSession(current);
      const stored = window.localStorage.getItem(ORG_KEY);
      const selected = current.organizations.find((org) => org.id === stored) ?? current.organizations[0];
      setOrganizationIdState(selected?.id ?? "");
      if (selected) window.localStorage.setItem(ORG_KEY, selected.id);
    }).catch((requestError: unknown) => {
      if (!active) return;
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Unable to verify your session.");
    });
    return () => { active = false; };
  }, [pathname, retryKey, router]);

  useEffect(() => {
    if (!organizationId || !session) return;
    let active = true;
    const load = () => apiRequest<{ count: number }>(`/organizations/${organizationId}/notifications/unread-count`, {}, organizationId)
      .then((result) => { if (active) setUnreadNotifications(result.count); })
      .catch(() => { /* Badge polling must not make the shell unavailable. */ });
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [organizationId, notificationRefresh, session]);

  function retrySession() {
    setError("");
    setRetryKey((value) => value + 1);
  }

  function setOrganizationId(id: string) {
    window.localStorage.setItem(ORG_KEY, id);
    setOrganizationIdState(id);
    setUnreadNotifications(0);
  }

  function refreshNotifications() { setNotificationRefresh((value) => value + 1); }

  async function logout() {
    try { await apiRequest("/auth/logout", { method: "POST" }); } catch { /* The local session still needs to end. */ }
    window.localStorage.removeItem(ORG_KEY);
    router.replace("/login");
    router.refresh();
  }

  if (error) return <main className="grid min-h-screen place-items-center bg-[#111] p-6"><div className="w-full max-w-xl"><ErrorState message={error} onRetry={retrySession} /></div></main>;
  if (!session) return <main className="min-h-screen bg-[#111] p-6 md:p-10"><PageSkeleton /></main>;

  const organization = session.organizations.find((item) => item.id === organizationId) ?? null;
  const displayName = [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") || session.user.email;

  return (
    <AppContext.Provider value={{ session, organization, setOrganizationId, unreadNotifications, refreshNotifications }}>
      <div className="min-h-screen bg-[#111] text-[#f0ede8] md:grid md:grid-cols-[248px_1fr]">
        <aside className="border-b border-[#2b2b2b] bg-[#151515] md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
          <div className="flex h-16 items-center justify-between px-5 md:h-auto md:block md:px-6 md:pt-7">
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="Recruiter workspace home">
              <span className="grid size-8 place-items-center bg-[#ff4d1c]"><ScanSearch className="size-4" /></span>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.17em]">AI Hiring</span>
            </Link>
            <Link href="/jobs/new" className="grid size-9 place-items-center border border-[#3a3a3a] md:hidden" aria-label="Create job"><Plus className="size-4" /></Link>
          </div>
          <nav className="flex overflow-x-auto px-3 pb-3 md:mt-10 md:block md:px-3" aria-label="Primary navigation">
            {navigation.filter((item) => !item.ownerOnly || organization?.role === "OWNER").map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-fit items-center gap-3 border-l-2 px-4 py-3 text-sm transition ${active ? "border-[#ff4d1c] bg-[#202020] text-white" : "border-transparent text-[#8e8a84] hover:bg-[#1c1c1c] hover:text-white"}`}><Icon className="size-4" />{label}{href === "/notifications" && unreadNotifications > 0 ? <span className="ml-auto min-w-5 bg-[#ff4d1c] px-1.5 py-0.5 text-center font-mono text-[10px] text-white" aria-label={`${unreadNotifications} unread notifications`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}</Link>;
            })}
          </nav>
          <div className="hidden md:absolute md:bottom-0 md:block md:w-[247px] md:border-t md:border-[#2b2b2b] md:p-4">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 truncate text-xs text-[#777]">{session.user.email}</p>
            <button type="button" onClick={logout} className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#888] hover:text-white"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex min-h-16 items-center justify-between border-b border-[#2b2b2b] px-5 md:px-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Recruiter workspace</p>
            <label className="flex items-center gap-3 text-xs text-[#888]">
              <span className="hidden sm:inline">Organization</span>
              <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="max-w-52 border border-[#353535] bg-[#191919] px-3 py-2 text-sm text-[#f0ede8] outline-none focus:border-[#ff4d1c]" aria-label="Select organization" disabled={!session.organizations.length}>
                {!session.organizations.length ? <option value="">No organizations</option> : null}
                {session.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </label>
          </header>
          <main className="mx-auto max-w-[1440px] p-5 md:p-8 lg:p-10">{children}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
