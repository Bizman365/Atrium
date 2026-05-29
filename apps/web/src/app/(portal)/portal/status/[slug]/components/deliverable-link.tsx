import { ExternalLink, FileText, Link as LinkIcon, Paperclip } from "lucide-react";

function iconForType(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("file") || normalized.includes("pdf") || normalized.includes("doc")) return FileText;
  if (normalized.includes("link")) return LinkIcon;
  return Paperclip;
}

export function DeliverableLink({
  title,
  type,
  url,
}: {
  title: string;
  type: string;
  url?: string | null;
}) {
  const Icon = iconForType(type);
  const content = (
    <span className="inline-flex items-center gap-2 text-sm text-pexlo-ink">
      <Icon aria-hidden className="h-4 w-4 text-pexlo-terracotta" />
      <span>{title}</span>
      {url ? <ExternalLink aria-hidden className="h-3.5 w-3.5 text-pexlo-ink-soft" /> : null}
    </span>
  );

  if (!url) return <span>{content}</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer" className="hover:text-pexlo-terracotta-deep hover:underline">
      {content}
    </a>
  );
}
