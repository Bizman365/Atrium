export default function NotFound() {
  return (
    <main className="min-h-screen bg-pexlo-paper px-6 py-16 text-pexlo-ink">
      <div className="mx-auto max-w-2xl border-t border-pexlo-hairline pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pexlo-terracotta-deep">404</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Project not found</h1>
        <p className="mt-6 leading-7 text-pexlo-ink-soft">
          We could not find a client-visible Pexlo project for this status URL.
        </p>
      </div>
    </main>
  );
}
