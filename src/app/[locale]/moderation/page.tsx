import { redirect } from "next/navigation";

export default async function ModerationIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // The section has no overview of its own — the dashboard already carries the
  // counts, so land the manager on the list they actually act from.
  redirect(`/${locale}/moderation/participants`);
}
