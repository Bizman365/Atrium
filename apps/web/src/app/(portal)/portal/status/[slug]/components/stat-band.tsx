export function StatBand({
  tasksTotal,
  completionPercent,
  deliverablesCount,
}: {
  tasksTotal: number;
  completionPercent: number;
  deliverablesCount: number;
}) {
  const stats = [
    { label: "Visible tasks", value: String(tasksTotal) },
    { label: "Completion", value: `${completionPercent}%` },
    { label: "Deliverables", value: String(deliverablesCount) },
    { label: "Hours", value: "Omitted" },
  ];

  return (
    <section className="border-y border-pexlo-hairline py-7">
      <dl className="grid gap-8 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pexlo-ink-soft">
              {stat.label}
            </dt>
            <dd className="mt-3 font-serif text-4xl tracking-[-0.04em] text-pexlo-ink">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
