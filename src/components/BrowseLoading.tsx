export function BrowseLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-slate-600">Loading {label.toLowerCase()} listings…</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]" aria-hidden="true">
        <div className="h-80 rounded-xl bg-slate-100 motion-safe:animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-72 rounded-xl bg-slate-100 motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
