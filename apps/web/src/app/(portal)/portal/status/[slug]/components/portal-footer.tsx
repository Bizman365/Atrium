function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function PortalFooter({ generatedAt }: { generatedAt: Date }) {
  return (
    <footer className="border-t border-pexlo-hairline py-8 text-sm text-pexlo-ink-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold tracking-[0.18em] text-pexlo-ink">PEXLO · pexlo.com</p>
          <p className="mt-2 max-w-2xl leading-6">
            Client-visible project summary generated from Pexlo Portal. This view omits internal notes,
            audit events, and non-client-visible work items.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em]">Generated {formatTimestamp(generatedAt)}</p>
      </div>
    </footer>
  );
}
