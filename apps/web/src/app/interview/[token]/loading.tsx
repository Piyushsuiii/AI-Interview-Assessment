export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1eb] text-[#171713]" role="status">
      <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#716d65]">
        <span className="size-3 animate-pulse bg-[#d94f28]" aria-hidden="true" />
        Loading invitation
      </div>
    </main>
  );
}
