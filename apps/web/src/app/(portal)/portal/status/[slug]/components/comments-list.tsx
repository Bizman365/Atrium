import type { StatusComment } from "../queries";

function authorName(authorId: string) {
  if (authorId === "user-pexlo-agent") return "Pexlo Agent";
  return "Pexlo Team";
}

function relativeDate(date: Date | string) {
  const then = new Date(date).getTime();
  const diffMs = Date.now() - then;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function CommentsList({ comments, title = "Pexlo Team Notes" }: { comments: StatusComment[]; title?: string }) {
  if (comments.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-pexlo-hairline bg-white/35 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pexlo-ink-soft">{title}</p>
      <ul className="mt-4 space-y-4">
        {comments.map((comment) => (
          <li key={comment.id} className="border-t border-pexlo-hairline/70 pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-pexlo-ink-soft">
              <span className="font-semibold text-pexlo-ink">{authorName(comment.authorId)}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(comment.createdAt).toISOString()}>{relativeDate(comment.createdAt)}</time>
            </div>
            <p className="mt-2 text-sm leading-6 text-pexlo-ink-soft">{comment.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
