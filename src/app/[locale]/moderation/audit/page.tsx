import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/vocabulary";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

/**
 * The moderation audit log.
 *
 * Append-only by construction: nothing in the application writes to a
 * ModerationEvent after it is created, and no screen offers to. That is the
 * point — the value of this page is that it answers "who did this, to whom, when
 * and why" months later, and a record that can be edited answers nothing.
 */
export default async function AuditPage() {
  await requireRole("MANAGER");

  const [t, format, events] = await Promise.all([
    getTranslations("moderation"),
    getFormatter(),
    db.moderationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        reason: true,
        previousStatus: true,
        createdAt: true,
        actor: { select: { name: true } },
        targetUser: {
          select: {
            name: true,
            role: true,
            status: true,
            sellerProfile: { select: { company: true } },
            buyerProfile: { select: { company: true } },
          },
        },
        targetAsset: { select: { ref: true, title: true, status: true } },
      },
    }),
  ]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="h-8 w-8" />}
        title={t("noEvents")}
        description={t("noEventsHint")}
      />
    );
  }

  return (
    <ol className="space-y-2">
      {events.map((event) => {
        const target =
          event.targetType === "USER"
            ? event.targetUser
            : null;

        const targetLabel =
          event.targetType === "USER"
            ? [
                target?.name,
                target?.sellerProfile?.company ?? target?.buyerProfile?.company,
              ]
                .filter(Boolean)
                .join(" · ")
            : `#${event.targetAsset?.ref} · ${event.targetAsset?.title ?? ""}`;

        return (
          <li key={event.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={toneFor(event.action)}>{t(`action_${event.action}`)}</Badge>
                    <Badge tone="neutral">{t(`target_${event.targetType}`)}</Badge>
                    {target?.role ? (
                      <span className="text-[13px] text-faint">
                        {ROLE_LABELS[target.role]}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-[15px] font-semibold text-ink">
                    {event.targetType === "ASSET" && event.targetAsset ? (
                      <Link
                        href={`/assets/${event.targetAsset.ref}`}
                        className="hover:text-brand"
                      >
                        {targetLabel}
                      </Link>
                    ) : (
                      targetLabel
                    )}
                  </p>

                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                    {event.reason}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold text-ink">{event.actor.name}</p>
                  <p className="text-[12px] text-faint">
                    {format.dateTime(event.createdAt, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {event.previousStatus ? (
                    <p className="mt-1 text-[12px] text-faint">
                      {t("wasBefore", { status: event.previousStatus })}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function toneFor(action: "SUSPEND" | "UNSUSPEND" | "REMOVE") {
  if (action === "REMOVE") return "danger" as const;
  if (action === "SUSPEND") return "warning" as const;
  return "success" as const;
}
