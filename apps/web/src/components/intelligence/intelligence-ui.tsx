import type { ReactNode } from "react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";

export const panel = "border border-[#303030] bg-[#181818]";
export const label = "font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]";

export function IntelligenceHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-[#303030] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className={`${label} text-[#ff6b3f]`}>{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#98938d]">{description}</p></div>{action}</header>;
}

export function IntelligenceLoading({ label: text = "Loading intelligence" }: { label?: string }) {
  return <div role="status" className={`${panel} grid min-h-72 place-items-center`}><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-[#ff4d1c]" aria-hidden="true" /><p className="mt-3 text-sm text-[#98938d]">{text}</p></div></div>;
}

export function IntelligenceError({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="grid min-h-64 place-items-center border border-red-950 bg-red-950/10 p-6 text-center"><div><AlertTriangle className="mx-auto size-6 text-red-400" aria-hidden="true" /><h2 className="mt-3 font-semibold">Unable to load intelligence</h2><p className="mt-2 max-w-lg text-sm text-[#aaa6a0]">{message}</p>{retry ? <button type="button" onClick={retry} className="mt-5 border border-[#494949] px-4 py-2 font-mono text-xs uppercase tracking-wider hover:border-white">Try again</button> : null}</div></div>;
}

export function IntelligenceEmpty({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-64 place-items-center border border-dashed border-[#393939] bg-[#161616] p-6 text-center"><div><Inbox className="mx-auto size-6 text-[#ff4d1c]" aria-hidden="true" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#8e8a84]">{description}</p></div></div>;
}

export function ScoreBar({ value, label: accessibleLabel }: { value?: number | null; label: string }) {
  const percentage = typeof value === "number" ? Math.max(0, Math.min(100, value <= 1 ? value * 100 : value)) : 0;
  return <div className="mt-3 h-1.5 overflow-hidden bg-[#303030]" role="progressbar" aria-label={accessibleLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={typeof value === "number" ? Math.round(percentage) : undefined}><div className="h-full bg-[#ff4d1c]" style={{ width: `${percentage}%` }} /></div>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex border border-[#3a3a3a] bg-[#202020] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#c8c3bc]">{children}</span>;
}

export function EvidenceText({ item }: { item: string | { quote?: string; text?: string; source?: string; rationale?: string } }) {
  if (typeof item === "string") return <p>{item}</p>;
  return <div><p>{item.quote ?? item.text ?? "Evidence text unavailable"}</p>{item.rationale ? <p className="mt-2 text-xs text-[#89847e]">{item.rationale}</p> : null}{item.source ? <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#777]">{item.source}</p> : null}</div>;
}
