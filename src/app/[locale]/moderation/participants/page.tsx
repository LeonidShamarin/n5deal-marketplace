import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";

import { SearchBox } from "@/components/catalogue/controls";
import { ModerationActions } from "@/components/moderation-actions";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ROLE_LABELS, USER_STATUS_LABELS, countryName } from "@/lib/vocabulary";

export const metadata: Metadata = { title: "Participants" };

const PAGE_SIZE = 25;

/**
 * The participant list a manager acts from.
 *
 * Search and the role/status filters go through the URL like every other list in
 * this app, so a manager can bookmark "all suspended sellers" and come back to
 * it. Suspended and removed participants stay in the list — hiding them would
 * make it impossible to reinstate anyone or to see what was done.
 */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("MANAGER");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const role = String(params.role ?? "");
  const status = String(params.status ?? "");

  const [t, tc, format] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const where: Prisma.UserWhereInput = {
    AND: [
      { role: { not: "MANAGER" } },
      role === "SELLER" || role === "BUYER" ? { role } : {},
      status === "ACTIVE" || status === "SUSPENDED" || status === "REMOVED"
        ? { status }
        : {},
      q === ""
        ? {}
        : {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { sellerProfile: { company: { contains: q, mode: "insensitive" } } },
              { buyerProfile: { company: { contains: q, mode: "insensitive" } } },
            ],
          },
    ],
  };

  const users = await db.user.findMany({
    where,
    orderBy: [{ status: "asc" }, { role: "asc" }, { name: "asc" }],
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      statusReason: true,
      statusChangedAt: true,
      sellerProfile: { select: { company: true, country: true, verified: true } },
      buyerProfile: { select: { id: true, company: true, country: true } },
      _count: { select: { assets: true } },
    },
  });

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <SearchBox placeholder={t("searchParticipants")} />
        <FilterLinks
          paramKey="role"
          current={role}
          options={[
            { value: "", label: tc("all") },
            { value: "SELLER", label: ROLE_LABELS.SELLER },
            { value: "BUYER", label: ROLE_LABELS.BUYER },
          ]}
        />
        <FilterLinks
          paramKey="status"
          current={status}
          options={[
            { value: "", label: tc("all") },
            { value: "ACTIVE", label: USER_STATUS_LABELS.ACTIVE },
            { value: "SUSPENDED", label: USER_STATUS_LABELS.SUSPENDED },
            { value: "REMOVED", label: USER_STATUS_LABELS.REMOVED },
          ]}
        />
      </div>

      <p className="mt-4 text-[14px] text-muted">{tc("results", { count: users.length })}</p>

      {users.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={t("noParticipants")}
            description={t("noParticipantsHint")}
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {users.map((user) => {
            const company =
              user.sellerProfile?.company ?? user.buyerProfile?.company ?? "—";
            const country = user.sellerProfile?.country ?? user.buyerProfile?.country;

            return (
              <li key={user.id}>
                <Card
                  className={user.status === "ACTIVE" ? "p-4" : "border-danger/20 p-4"}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-ink">{user.name}</span>
                        <Badge tone="neutral">{ROLE_LABELS[user.role]}</Badge>
                        <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>
                          {USER_STATUS_LABELS[user.status]}
                        </Badge>
                        {user.sellerProfile?.verified ? (
                          <Badge tone="brand">{t("verified")}</Badge>
                        ) : null}
                      </div>

                      <p className="mt-0.5 truncate text-[14px] text-muted">
                        {company}
                        {country ? ` · ${countryName(country)}` : ""} · {user.email}
                        {user.role === "SELLER"
                          ? ` · ${t("listingCount", { count: user._count.assets })}`
                          : ""}
                      </p>

                      {user.statusReason ? (
                        <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[13px] text-danger">
                          {user.statusReason}
                          {user.statusChangedAt
                            ? ` — ${format.relativeTime(user.statusChangedAt)}`
                            : ""}
                        </p>
                      ) : null}

                      {user.buyerProfile ? (
                        <Link
                          href={`/buyers/${user.buyerProfile.id}`}
                          className="mt-2 inline-block text-[13px] font-semibold text-brand hover:underline"
                        >
                          {t("viewMandate")}
                        </Link>
                      ) : null}
                    </div>

                    {user.status === "REMOVED" ? (
                      <p className="shrink-0 text-[13px] text-faint">
                        {t("removalPermanent")}
                      </p>
                    ) : (
                        <ModerationActions
                          targetId={user.id}
                          actions={
                            user.status === "SUSPENDED"
                              ? [
                                  { kind: "unsuspendUser", label: t("unsuspend") },
                                  { kind: "removeUser", label: t("remove"), danger: true },
                                ]
                              : [
                                  { kind: "suspendUser", label: t("suspend") },
                                  { kind: "removeUser", label: t("remove"), danger: true },
                                ]
                          }
                      />
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Plain links rather than a client-side control: these filters are two or three
 * fixed values, and a link keeps them shareable and back-button friendly with no
 * JavaScript at all.
 */
function FilterLinks({
  paramKey,
  current,
  options,
}: {
  paramKey: string;
  current: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-panel p-1">
      {options.map((option) => {
        const active = current === option.value;
        return (
          <Link
            key={option.value || "all"}
            href={
              option.value === ""
                ? "/moderation/participants"
                : `/moderation/participants?${paramKey}=${option.value}`
            }
            className={
              active
                ? "rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-white"
                : "rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-ink"
            }
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
