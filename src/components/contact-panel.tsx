"use client";

import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, Field, Textarea } from "@/components/ui/primitives";
import { Link, useRouter } from "@/i18n/navigation";
import { contactAction } from "@/server/actions/threads";

/**
 * The contact box on a listing or a buyer profile.
 *
 * It is deliberately explicit about why it is unavailable rather than simply
 * absent — a signed-out visitor is told to sign in, a seller is told that
 * sellers do not buy. A missing button leaves people wondering whether the page
 * is broken.
 *
 * The action itself re-checks all of this on the server; nothing here is a
 * security boundary.
 */
export function ContactPanel({
  assetRef,
  counterpartId,
  canContact,
  viewerRole,
  locale,
  variant = "seller",
}: {
  assetRef?: number;
  counterpartId: string;
  canContact: boolean;
  viewerRole: Role | null;
  locale: string;
  /** Which side is being contacted — only changes the wording. */
  variant?: "seller" | "buyer";
}) {
  const t = useTranslations("contact");
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canContact) {
    return (
      <Card className="p-5">
        <p className="text-[14px] font-semibold text-ink">
          {variant === "seller" ? t("contactSeller") : t("contactBuyer")}
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {viewerRole === null
            ? t("signInToContact")
            : viewerRole === "MANAGER"
              ? t("managersDoNotTrade")
              : t("wrongSide")}
        </p>
        {viewerRole === null ? (
          <Link href="/sign-in" className="mt-3 block">
            <Button full variant="outline">
              {t("signIn")}
            </Button>
          </Link>
        ) : null}
      </Card>
    );
  }

  function submit() {
    setError(null);
    setNotice(null);

    const formData = new FormData();
    if (assetRef !== undefined) formData.set("assetRef", String(assetRef));
    formData.set("counterpartId", counterpartId);
    formData.set("body", body);

    startTransition(async () => {
      const result = await contactAction(formData);

      if (!result.ok) {
        setError(result.fieldErrors?.body?.[0] ?? result.message);
        return;
      }

      // Saying which of the two happened is the point: a second "contact" on the
      // same listing must visibly land in the existing conversation rather than
      // silently creating a duplicate.
      setNotice(result.data.created ? t("started") : t("reopened"));
      setBody("");
      setOpen(false);
      router.push(`/inbox/${result.data.threadId}`);
    });
  }

  return (
    <Card className="p-5">
      <p className="text-[14px] font-semibold text-ink">
        {variant === "seller" ? t("contactSeller") : t("contactBuyer")}
      </p>
      <p className="mt-1 text-[13px] text-muted">{t("hint")}</p>

      {open ? (
        <div className="mt-3 space-y-3">
          <Field id="contact-body" label={t("yourMessage")} error={error ?? undefined}>
            <Textarea
              id="contact-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("placeholder")}
              maxLength={4000}
              aria-invalid={error ? true : undefined}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" onClick={submit} disabled={pending} full>
              {pending ? t("sending") : t("send")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          full
          className="mt-3"
          onClick={() => setOpen(true)}
          data-locale={locale}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {variant === "seller" ? t("contactSeller") : t("contactBuyer")}
        </Button>
      )}

      {notice ? (
        <p className="mt-2 text-[13px] font-medium text-success" role="status">
          {notice}
        </p>
      ) : null}
    </Card>
  );
}
