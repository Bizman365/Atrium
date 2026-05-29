import { DeliverableLink } from "./deliverable-link";

type Deliverable = {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  file?: { url?: string | null } | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  completedAt?: Date | string | null;
  deliverables: Deliverable[];
};

function formatDate(date?: Date | string | null) {
  if (!date) return "Pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function TaskRow({ task, index }: { task: Task; index: number }) {
  return (
    <article className="grid gap-5 border-t border-pexlo-hairline py-9 sm:grid-cols-[72px_1fr]">
      <div className="font-serif text-3xl text-pexlo-terracotta-deep">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-serif text-2xl leading-tight tracking-[-0.02em] text-pexlo-ink">{task.title}</h3>
          <p className="text-xs uppercase tracking-[0.18em] text-pexlo-ink-soft">{formatDate(task.completedAt)}</p>
        </div>
        {task.description ? (
          <p className="mt-4 max-w-3xl text-base leading-7 text-pexlo-ink-soft">{task.description}</p>
        ) : null}
        {task.deliverables.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pexlo-ink-soft">Deliverables</p>
            <ul className="space-y-2">
              {task.deliverables.map((deliverable) => (
                <li key={deliverable.id}>
                  <DeliverableLink
                    title={deliverable.title}
                    type={deliverable.type}
                    url={deliverable.url ?? deliverable.file?.url}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
