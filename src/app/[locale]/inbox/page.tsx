import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import {
  getFormatter,
  getLocale,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { Badge, Card, EmptyState, PageHeading } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { formatMoneyCompact } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { CATEGORY_LABELS, countryName } from "@/lib/vocabulary";
import { listThreadsFor } from "@/server/queries/threads";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Signed in, or a real 401 — the inbox has no public view at all.
  const me = await requireUser();

  const [t, te, threads, format, currentLocale] = await Promise.all([
    getTranslations("inbox"),
    getTranslations("empty"),
    listThreadsFor(me.id),
    getFormatter(),
    getLocale(),
  ]);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <PageHeading title={t("title")} description={t("subtitle")} />

      {threads.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MessagesSquare className="h-8 w-8" />}
            title={te("noMessages")}
            description={te("noMessagesHint")}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {threads.map((thread) => {
            const other = thread.buyerId === me.id ? thread.seller : thread.buyer;
            const last = thread.messages[0];
            const unread =
              last !== undefined && last.senderId !== me.id && last.readAt === null;
            const company =
              other.sellerProfile?.company ?? other.buyerProfile?.company ?? other.name;

            return (
              <li key={thread.id}>
                <Link href={`/inbox/${thread.id}`} className="block">
                  <Card className="hover:border-line-strong p-4 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink truncate text-[15px] font-bold">
                          {company}
                        </p>
                        <p className="text-muted truncate text-[13px]">{other.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {unread ? <Badge tone="brand">{t("unread")}</Badge> : null}
                        {other.status !== "ACTIVE" ? (
                          <Badge tone="danger">{t("inactiveParty")}</Badge>
                        ) : null}
                        <span className="text-faint text-[12px]">
                          {format.relativeTime(thread.lastMessageAt)}
                        </span>
                      </div>
                    </div>

                    {thread.asset ? (
                      <p className="bg-panel text-muted mt-2 truncate rounded-lg px-2.5 py-1.5 text-[13px]">
                        #{thread.asset.ref} · {thread.asset.title} ·{" "}
                        {CATEGORY_LABELS[thread.asset.category]} ·{" "}
                        {countryName(thread.asset.country)} ·{" "}
                        {formatMoneyCompact(
                          thread.asset.askingPrice,
                          thread.asset.currency,
                          currentLocale,
                        )}
                      </p>
                    ) : (
                      <p className="text-faint mt-2 text-[13px]">{t("generalThread")}</p>
                    )}

                    {last ? (
                      <p className="line-clamp-2-safe text-muted mt-2 text-[14px]">
                        <span className="text-ink font-semibold">
                          {last.senderId === me.id ? t("you") : other.name.split(" ")[0]}:
                        </span>{" "}
                        {last.body}
                      </p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
