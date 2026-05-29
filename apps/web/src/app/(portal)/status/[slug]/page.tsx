import { redirect } from "next/navigation";

export default async function LegacyStatusAlias({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/portal/status/${slug}`);
}
