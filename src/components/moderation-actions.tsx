"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/session";
import {
  removeUserAction,
  suspendAssetAction,
  suspendUserAction,
  unsuspendAssetAction,
  unsuspendUserAction,
} from "@/server/actions/moderation";

type ActionKind =
  | "suspendUser"
  | "unsuspendUser"
  | "removeUser"
  | "suspendAsset"
  | "unsuspendAsset";

const HANDLERS: Record<ActionKind, (formData: FormData) => Promise<ActionResult<unknown>>> = {
  suspendUser: suspendUserAction,
  unsuspendUser: unsuspendUserAction,
  removeUser: removeUserAction,
  suspendAsset: suspendAssetAction,
  unsuspendAsset: unsuspendAssetAction,
};

const FIELD: Record<ActionKind, "userId" | "assetId"> = {
  suspendUser: "userId",
  unsuspendUser: "userId",
  removeUser: "userId",
  suspendAsset: "assetId",
  unsuspendAsset: "assetId",
};

/**
 * A moderation action with its reason.
 *
 * The reason is not optional and not an afterthought: the panel expands into a
 * text box before anything happens, and the server rejects a short one anyway.
 * That is what makes the audit log worth reading six months later — every row
 * has a person, a target, a time and a stated why.
 *
 * Removal asks for a second, explicit confirmation because it is the one action
 * here that cannot be undone.
 */
export function ModerationActions({
  targetId,
  actions,
}: {
  targetId: string;
  actions: ReadonlyArray<{ kind: ActionKind; label: string; danger?: boolean }>;
}) {
  const t = useTranslations("moderation");
  const router = useRouter();

  const [open, setOpen] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(null);
    setReason("");
    setConfirmed(false);
    setError(null);
  }

  function submit(kind: ActionKind) {
    setError(null);

    const formData = new FormData();
    formData.set(FIELD[kind], targetId);
    formData.set("reason", reason);

    startTransition(async () => {
      const result = await HANDLERS[kind](formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      reset();
      router.refresh();
    });
  }

  if (open === null) {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.kind}
            type="button"
            size="sm"
            variant={action.danger ? "dangerOutline" : "subtle"}
            onClick={() => setOpen(action.kind)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  const isRemoval = open === "removeUser";

  return (
    // basis-full makes the expanded panel take a line of its own inside the
    // wrapping flex row. Left in the narrow action column it rendered as a
    // ~200px slot with the textarea scrolling three words at a time.
    <div className="w-full basis-full rounded-xl border border-line bg-panel p-3">
      <label
        htmlFor={`reason-${targetId}`}
        className="block text-[13px] font-semibold text-ink"
      >
        {t("reasonLabel")}
      </label>
      <Textarea
        id={`reason-${targetId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("reasonPlaceholder")}
        className="mt-1.5 min-h-20 bg-white"
        maxLength={500}
        aria-invalid={error ? true : undefined}
      />

      {isRemoval ? (
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px] text-danger">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-danger)]"
          />
          {t("confirmRemoval")}
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={isRemoval ? "danger" : "primary"}
          disabled={pending || reason.trim().length < 10 || (isRemoval && !confirmed)}
          onClick={() => submit(open)}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {t("confirm")}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={reset}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
