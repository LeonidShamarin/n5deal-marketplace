import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { MessageComposer } from "@/components/message-composer";
import { Badge, Card } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatMoneyCompact } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { CATEGORY_LABELS, LICENSE_LABELS, countryName } from "@/lib/vocabulary";
import { markThreadReadAction } from "@/server/actions/threads";
import { getThreadFor } from "@/server/queries/threads";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ locale: string; threadId: string }>;
}) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);

  const me = await requireUser();

  // Participation is inside the query, so someone else's thread id is simply
  // not found rather than found-and-then-refused.
  const thread = await getThreadFor(threadId, me.id);
  if (!thread) notFound();

  await markThreadReadAction(thread.id);

  const [t, format, currentLocale] = await Promise.all([
    getTranslations("inbox"),
    getFormatter(),
    getLocale(),
  ]);

  const other = thread.buyerId === me.id ? thread.seller : thread.buyer;
  const company = other.sellerProfile?.company ?? other.buyerProfile?.company ?? other.name;
  const otherInactive = other.status !== "ACTIVE";

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToInbox")}
      </Link>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold text-ink">{company}</h1>
            <p className="truncate text-[14px] text-muted">{other.name}</p>
          </div>
          {otherInactive ? <Badge tone="danger">{t("inactiveParty")}</Badge> : null}
        </div>

        {thread.asset ? (
          <Link href={`/assets/${thread.asset.ref}`} className="mt-3 block">
            <div className="rounded-xl border border-line bg-panel px-3.5 py-3 transition-colors hover:border-line-strong">
              <p className="text-[13px] text-muted">{t("aboutListing")}</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-ink">
                #{thread.asset.ref} · {thread.asset.title}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {CATEGORY_LABELS[thread.asset.category]} ·{" "}
                {LICENSE_LABELS[thread.asset.licenseType]} ·{" "}
                {countryName(thread.asset.country)} ·{" "}
                {formatMoneyCompact(
                  thread.asset.askingPrice,
                  thread.asset.currency,
                  currentLocale,
                )}
              </p>
            </div>
          </Link>
        ) : null}
      </Card>

      <ol className="mt-4 space-y-3">
        {thread.messages.map((message) => {
          const mine = message.senderId === me.id;
          return (
            <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  mine
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-body",
                )}
              >
                <p className="whitespace-pre-line text-[15px] leading-relaxed">
                  {message.body}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-[11px]",
                    mine ? "text-white/70" : "text-faint",
                  )}
                >
                  {format.dateTime(message.createdAt, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {otherInactive ? (
          <Card className="border-warning/30 bg-warning-soft p-4 text-[14px] text-muted">
            {t("cannotReply")}
          </Card>
        ) : (
          <MessageComposer threadId={thread.id} />
        )}
      </div>
    </div>
  );
}
