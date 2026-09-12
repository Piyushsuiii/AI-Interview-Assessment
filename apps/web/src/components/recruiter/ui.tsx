import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, id, className, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <label className="grid gap-2 text-sm text-[#d5d1ca]" htmlFor={inputId}>
      <span className="font-medium">{label}</span>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full border border-[#353535] bg-[#151515] px-3 text-[#f0ede8] outline-none transition placeholder:text-[#666] focus:border-[#ff4d1c] focus:ring-2 focus:ring-[#ff4d1c]/20 disabled:opacity-60",
          error && "border-red-500/70",
          className,
        )}
        {...props}
      />
      {error ? <span id={`${inputId}-error`} className="text-xs text-red-400">{error}</span> : null}
      {!error && hint ? <span id={`${inputId}-hint`} className="text-xs text-[#777]">{hint}</span> : null}
    </label>
  );
}

type SelectProps = ComponentProps<"select"> & { label: string; children: ReactNode };

export function Select({ label, id, className, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <label className="grid gap-2 text-sm text-[#d5d1ca]" htmlFor={selectId}>
      <span className="font-medium">{label}</span>
      <select
        id={selectId}
        className={cn("h-11 border border-[#353535] bg-[#151515] px-3 text-[#f0ede8] outline-none focus:border-[#ff4d1c] focus:ring-2 focus:ring-[#ff4d1c]/20", className)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Table({ children, className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[680px] border-collapse text-left text-sm", className)} {...props}>{children}</table>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="border border-[#303030] bg-[#191919] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[#f0ede8]">{value}</p>
      <p className="mt-2 text-xs text-[#8e8a84]">{detail}</p>
    </article>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-[#292929]", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-7" aria-label="Loading content" role="status">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      <Skeleton className="h-72 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-[#383838] bg-[#171717] px-6 text-center">
      <Inbox className="mb-4 size-6 text-[#ff4d1c]" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#8e8a84]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex min-h-56 flex-col items-center justify-center border border-red-950 bg-red-950/10 px-6 text-center">
      <AlertTriangle className="mb-4 size-6 text-red-400" aria-hidden="true" />
      <h2 className="font-semibold">We couldn&apos;t load this view</h2>
      <p className="mt-2 max-w-md text-sm text-[#aaa6a0]">{message}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-5 border border-[#444] px-4 py-2 font-mono text-xs uppercase tracking-wider hover:border-[#f0ede8]">Try again</button> : null}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button disabled={busy} className="btn-orange flex h-11 w-full items-center justify-center gap-2 px-5 text-xs disabled:cursor-not-allowed disabled:opacity-60">
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{children}
    </button>
  );
}

export const primaryLink = "btn-orange inline-flex h-10 items-center justify-center px-4 font-mono text-xs uppercase tracking-wider";
