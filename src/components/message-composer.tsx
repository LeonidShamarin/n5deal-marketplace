"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import { sendMessageAction } from "@/server/actions/threads";

function SendButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="h-4 w-4" aria-hidden />
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function MessageComposer({ threadId }: { threadId: string }) {
  const t = useTranslations("inbox");
  const [state, formAction] = useActionState(sendMessageAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Clear the box and pull the new message in only after the server confirms it.
  // Optimistically appending would show a message that may not have been stored.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea
        name="body"
        required
        maxLength={4000}
        placeholder={t("replyPlaceholder")}
        aria-label={t("replyPlaceholder")}
        aria-invalid={state && !state.ok ? true : undefined}
      />
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-[13px] font-medium">
          {state.fieldErrors?.body?.[0] ?? state.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SendButton label={t("send")} pendingLabel={t("sending")} />
      </div>
    </form>
  );
}
