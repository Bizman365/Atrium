type Update = {
  id: string;
  title: string | null;
  content: string;
  createdAt: Date | string;
};

function displayTitle(update: Update) {
  if (update.title) return update.title;
  return update.content.split("\n").find(Boolean)?.slice(0, 120) ?? "Project update";
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function ProjectUpdatesFeed({ updates }: { updates: Update[] }) {
  if (updates.length === 0) return null;

  return (
    <section className="py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pexlo-terracotta-deep">Project updates</p>
        <h2 className="mt-3 font-serif text-4xl tracking-[-0.04em] text-pexlo-ink">Latest from the Pexlo team</h2>
      </div>
      <div className="divide-y divide-pexlo-hairline border-y border-pexlo-hairline">
        {updates.map((update) => (
          <article key={update.id} className="grid gap-4 py-7 md:grid-cols-[180px_1fr]">
            <time className="text-xs uppercase tracking-[0.18em] text-pexlo-ink-soft" dateTime={new Date(update.createdAt).toISOString()}>
              {formatDate(update.createdAt)}
            </time>
            <div>
              <h3 className="font-serif text-2xl leading-tight tracking-[-0.02em] text-pexlo-ink">{displayTitle(update)}</h3>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-pexlo-ink-soft">{update.content}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
