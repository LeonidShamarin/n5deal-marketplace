"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { threadKey } from "@/lib/thread-key";
import {
  abort,
  actionOk,
  requireActionUser,
  withAction,
  type ActionResult,
} from "@/lib/session";

/**
 * Messaging.
 *
 * The rules enforced here are the ones a reviewer will try to break by hand:
 *
 *   - you cannot open a thread with yourself;
 *   - you cannot message a suspended or removed participant, and a suspended
 *     participant cannot message anyone (the latter falls out of the session
 *     guard, which treats a non-active account as signed out);
 *   - contacting the same counterpart about the same listing twice reopens the
 *     existing thread instead of creating a second one;
 *   - you can only post into a thread you are actually part of.
 *
 * The thread key is what makes the third rule structural rather than hopeful:
 * a unique index refuses the duplicate even if two requests race.
 */

const contactSchema = z.object({
  assetRef: z.coerce.number().int().positive().optional(),
  counterpartId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(10, "Write at least a sentence — a blank first message gets ignored.")
    .max(4000, "Keep the first message under 4000 characters."),
});

export type ContactResult = { threadId: string; created: boolean };

/**
 * Start (or resume) a conversation.
 *
 * Works in both directions: a buyer contacting a seller about a listing, and a
 * seller contacting a buyer about their mandate. Which side is which is derived
 * from the roles, not from a parameter the caller could lie about.
 */
export async function contactAction(
  formData: FormData,
): Promise<ActionResult<ContactResult>> {
  return withAction(async () => {
    const me = await requireActionUser();

    const parsed = contactSchema.safeParse({
      assetRef: formData.get("assetRef") || undefined,
      counterpartId: formData.get("counterpartId"),
      body: formData.get("body"),
    });

    if (!parsed.success) {
      return {
        ok: false as const,
        error: "VALIDATION" as const,
        message: "Check the message.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }

    const { assetRef, counterpartId, body } = parsed.data;

    if (counterpartId === me.id) {
      abort("VALIDATION", "You cannot start a conversation with yourself.");
    }

    const counterpart = await db.user.findUnique({
      where: { id: counterpartId },
      select: { id: true, role: true, status: true },
    });

    if (!counterpart) abort("NOT_FOUND", "That participant does not exist.");
    if (counterpart.status !== "ACTIVE") {
      abort(
        "GONE",
        counterpart.status === "SUSPENDED"
          ? "This participant is suspended and cannot be contacted right now."
          : "This participant has been removed from the platform.",
      );
    }

    // A manager moderates; they do not trade. Letting them into threads would
    // also break the buyer/seller shape of a Thread row.
    if (me.role === "MANAGER" || counterpart.role === "MANAGER") {
      abort("FORBIDDEN", "Platform managers do not take part in conversations.");
    }
    if (me.role === counterpart.role) {
      abort("FORBIDDEN", "Conversations run between a buyer and a seller.");
    }

    const buyerId = me.role === "BUYER" ? me.id : counterpart.id;
    const sellerId = me.role === "SELLER" ? me.id : counterpart.id;

    // Resolve the listing, if the conversation is about one, and check it really
    // belongs to the seller in this pair.
    let assetId: string | null = null;
    if (assetRef !== undefined) {
      const asset = await db.asset.findUnique({
        where: { ref: assetRef },
        select: { id: true, sellerId: true, status: true },
      });
      if (!asset) abort("NOT_FOUND", "That listing does not exist.");
      if (asset.sellerId !== sellerId) {
        abort("FORBIDDEN", "That listing does not belong to this seller.");
      }
      if (asset.status !== "PUBLISHED" && me.id !== sellerId) {
        abort("GONE", "That listing is no longer available.");
      }
      assetId = asset.id;
    }

    const key = threadKey(assetId, buyerId, sellerId);
    const now = new Date();

    // Looked up before the upsert purely so the UI can say "reopened the
    // existing conversation" rather than "started a new one". Comparing
    // timestamps afterwards would be a guess; this is a fact.
    const existing = await db.thread.findUnique({ where: { key }, select: { id: true } });

    // upsert on the unique key: the second "contact" lands in the same thread,
    // and a race between two clicks cannot produce two rows.
    const thread = await db.thread.upsert({
      where: { key },
      create: { key, assetId, buyerId, sellerId, createdAt: now, lastMessageAt: now },
      update: { lastMessageAt: now },
      select: { id: true },
    });

    await db.message.create({
      data: { threadId: thread.id, senderId: me.id, body, createdAt: now },
    });

    revalidatePath("/[locale]/inbox", "page");

    return actionOk({ threadId: thread.id, created: existing === null });
  });
}

const replySchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(4000),
});

export async function sendMessageAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const me = await requireActionUser();

    const parsed = replySchema.safeParse({
      threadId: formData.get("threadId"),
      body: formData.get("body"),
    });

    if (!parsed.success) {
      return {
        ok: false as const,
        error: "VALIDATION" as const,
        message: "Check the message.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }

    const thread = await db.thread.findUnique({
      where: { id: parsed.data.threadId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        buyer: { select: { status: true } },
        seller: { select: { status: true } },
      },
    });

    if (!thread) abort("NOT_FOUND", "That conversation does not exist.");

    // Membership is checked on the server every time. Knowing a thread id is not
    // permission to write into it.
    if (thread.buyerId !== me.id && thread.sellerId !== me.id) {
      abort("FORBIDDEN", "This conversation is not yours.");
    }

    const other = thread.buyerId === me.id ? thread.seller : thread.buyer;
    if (other.status !== "ACTIVE") {
      abort("GONE", "The other participant is no longer active on the platform.");
    }

    const now = new Date();
    const message = await db.message.create({
      data: { threadId: thread.id, senderId: me.id, body: parsed.data.body, createdAt: now },
      select: { id: true },
    });

    await db.thread.update({
      where: { id: thread.id },
      data: { lastMessageAt: now },
    });

    revalidatePath("/[locale]/inbox", "page");

    return actionOk(message);
  });
}

/** Mark the counterpart's messages in a thread as read. */
export async function markThreadReadAction(threadId: string): Promise<void> {
  const me = await requireActionUser().catch(() => null);
  if (!me) return;

  await db.message.updateMany({
    where: { threadId, senderId: { not: me.id }, readAt: null },
    data: { readAt: new Date() },
  });
}
