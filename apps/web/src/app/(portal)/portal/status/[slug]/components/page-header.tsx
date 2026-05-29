export function PageHeader({ orgName }: { orgName: string }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b border-pexlo-hairline pb-8">
      <div>
        <p className="text-sm font-black tracking-[-0.04em] text-pexlo-terracotta">PEXLO</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-pexlo-ink-soft">
          Pexlo Portal · Client View
        </p>
      </div>
      <div className="text-right text-xs uppercase tracking-[0.18em] text-pexlo-ink-soft">
        <p>Prepared for</p>
        <p className="mt-1 normal-case tracking-normal text-pexlo-ink">{orgName}</p>
      </div>
    </header>
  );
}
