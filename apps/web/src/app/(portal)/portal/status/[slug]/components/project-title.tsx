function formatDate(date?: Date | string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ProjectTitle({
  name,
  description,
  status,
  createdAt,
  completedAt,
}: {
  name: string;
  description?: string | null;
  status: string;
  createdAt: Date | string;
  completedAt?: Date | string | null;
}) {
  return (
    <section className="py-14 sm:py-20">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-pexlo-terracotta-deep/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-pexlo-terracotta-deep">
          {statusLabel(status)}
        </span>
        <span className="text-sm text-pexlo-ink-soft">
          {formatDate(createdAt)} → {formatDate(completedAt)}
        </span>
      </div>
      <h1 className="mt-7 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.04em] text-pexlo-ink sm:text-7xl">
        {name}
      </h1>
      {description ? (
        <p className="mt-8 max-w-3xl text-lg leading-8 text-pexlo-ink-soft sm:text-xl">
          {description}
        </p>
      ) : null}
    </section>
  );
}
