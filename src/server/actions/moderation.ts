"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  abort,
  actionOk,
  requireActionRole,
  withAction,
  type ActionResult,
} from "@/lib/session";

/**
 * Moderation.
 *
 * Three rules shape this file, and they are the substance of the "remove or
 * suspend participants" requirement rather than decoration on it:
 *
 * 1. **Nothing is deleted.** Suspension and removal are statuses. The rows stay,
 *    the conversations stay, and the pages that referenced them explain what
 *    happened instead of 404-ing or crashing.
 *
 * 2. **Suspension is reversible, exactly.** Suspending a seller does not touch
 *    their listings at all — the catalogue hides them by joining on seller
 *    status. Unsuspending therefore restores precisely the previous state, with
 *    drafts still drafts and sold listings still sold. Suspending a single
 *    listing does mutate it, so its prior status is recorded first and restored
 *    on unsuspend rather than guessed as "published".
 *
 * 3. **Every action carries a reason and is written to the audit log.** A
 *    moderation decision nobody can explain later is not moderation.
 */

const reasonField = z
  .string()
  .trim()
  .min(10, "Give a reason of at least 10 characters — it goes in the audit log.")
  .max(500);

const userActionSchema = z.object({
  userId: z.string().min(1),
  reason: reasonField,
});

const assetActionSchema = z.object({
  assetId: z.string().min(1),
  reason: reasonField,
});

const unsuspendSchema = z.object({
  targetId: z.string().min(1),
  reason: reasonField,
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function suspendUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  return withAction(async () => {
    const manager = await requireActionRole("MANAGER");

    const parsed = userActionSchema.safeParse({
      userId: formData.get("userId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      abort("VALIDATION", z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Invalid request.");
    }

    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, status: true, role: true },
    });

    if (!target) abort("NOT_FOUND", "That participant does not exist.");
    if (target.id === manager.id) abort("FORBIDDEN", "You cannot suspend your own account.");
    if (target.role === "MANAGER") {
      abort("FORBIDDEN", "Managers are not moderated from this screen.");
    }
    if (target.status !== "ACTIVE") {
      abort("CONFLICT", "That participant is not active.");
    }

    const now = new Date();

    // One transaction: the status change and its audit entry are the same fact,
    // and an audit log with holes in it is worse than none.
    await db.$transaction([
      db.user.update({
        where: { id: target.id },
        data: { status: "SUSPENDED", statusReason: parsed.data.reason, statusChangedAt: now },
      }),
      db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "USER",
          action: "SUSPEND",
          targetUserId: target.id,
          reason: parsed.data.reason,
          previousStatus: target.status,
          createdAt: now,
        },
      }),
    ]);

    revalidateModeration();
    return actionOk({ userId: target.id });
  });
}

export async function unsuspendUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  return withAction(async () => {
    const manager = await requireActionRole("MANAGER");

    const parsed = unsuspendSchema.safeParse({
      targetId: formData.get("userId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      abort("VALIDATION", z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Invalid request.");
    }

    const target = await db.user.findUnique({
      where: { id: parsed.data.targetId },
      select: { id: true, status: true },
    });

    if (!target) abort("NOT_FOUND", "That participant does not exist.");

    // Removal is terminal on purpose. Reinstating a removed account would mean
    // the platform never really removed anyone, which is not what "remove" means
    // to the person who asked for it.
    if (target.status === "REMOVED") {
      abort("FORBIDDEN", "Removal is permanent. A removed participant cannot be reinstated.");
    }
    if (target.status !== "SUSPENDED") abort("CONFLICT", "That participant is not suspended.");

    const now = new Date();

    await db.$transaction([
      db.user.update({
        where: { id: target.id },
        // Their listings were never touched, so nothing needs restoring here:
        // the catalogue starts showing them again the moment the join passes.
        data: { status: "ACTIVE", statusReason: null, statusChangedAt: now },
      }),
      db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "USER",
          action: "UNSUSPEND",
          targetUserId: target.id,
          reason: parsed.data.reason,
          previousStatus: "SUSPENDED",
          createdAt: now,
        },
      }),
    ]);

    revalidateModeration();
    return actionOk({ userId: target.id });
  });
}

export async function removeUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  return withAction(async () => {
    const manager = await requireActionRole("MANAGER");

    const parsed = userActionSchema.safeParse({
      userId: formData.get("userId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      abort("VALIDATION", z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Invalid request.");
    }

    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, status: true, role: true },
    });

    if (!target) abort("NOT_FOUND", "That participant does not exist.");
    if (target.id === manager.id) abort("FORBIDDEN", "You cannot remove your own account.");
    if (target.role === "MANAGER") {
      abort("FORBIDDEN", "Managers are not moderated from this screen.");
    }
    if (target.status === "REMOVED") abort("CONFLICT", "That participant is already removed.");

    const now = new Date();

    await db.$transaction([
      db.user.update({
        where: { id: target.id },
        data: { status: "REMOVED", statusReason: parsed.data.reason, statusChangedAt: now },
      }),
      db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "USER",
          action: "REMOVE",
          targetUserId: target.id,
          reason: parsed.data.reason,
          previousStatus: target.status,
          createdAt: now,
        },
      }),
    ]);

    revalidateModeration();
    return actionOk({ userId: target.id });
  });
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export async function suspendAssetAction(
  formData: FormData,
): Promise<ActionResult<{ assetId: string }>> {
  return withAction(async () => {
    const manager = await requireActionRole("MANAGER");

    const parsed = assetActionSchema.safeParse({
      assetId: formData.get("assetId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      abort("VALIDATION", z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Invalid request.");
    }

    const asset = await db.asset.findUnique({
      where: { id: parsed.data.assetId },
      select: { id: true, ref: true, status: true },
    });

    if (!asset) abort("NOT_FOUND", "That listing does not exist.");
    if (asset.status === "SUSPENDED") abort("CONFLICT", "That listing is already suspended.");

    const now = new Date();

    await db.$transaction([
      db.asset.update({
        where: { id: asset.id },
        data: {
          status: "SUSPENDED",
          // Recorded now so that unsuspend can put it back exactly, instead of
          // assuming everything suspended used to be published.
          previousStatus: asset.status,
          statusReason: parsed.data.reason,
          statusChangedAt: now,
        },
      }),
      db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "ASSET",
          action: "SUSPEND",
          targetAssetId: asset.id,
          reason: parsed.data.reason,
          previousStatus: asset.status,
          createdAt: now,
        },
      }),
    ]);

    revalidateModeration();
    revalidatePath(`/[locale]/assets/${asset.ref}`, "page");
    return actionOk({ assetId: asset.id });
  });
}

export async function unsuspendAssetAction(
  formData: FormData,
): Promise<ActionResult<{ assetId: string }>> {
  return withAction(async () => {
    const manager = await requireActionRole("MANAGER");

    const parsed = unsuspendSchema.safeParse({
      targetId: formData.get("assetId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      abort("VALIDATION", z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Invalid request.");
    }

    const asset = await db.asset.findUnique({
      where: { id: parsed.data.targetId },
      select: { id: true, ref: true, status: true, previousStatus: true },
    });

    if (!asset) abort("NOT_FOUND", "That listing does not exist.");
    if (asset.status !== "SUSPENDED") abort("CONFLICT", "That listing is not suspended.");

    // Fall back to DRAFT rather than PUBLISHED when there is nothing recorded:
    // an accidental republish is a worse failure than an accidental unpublish.
    const restored = asset.previousStatus ?? "DRAFT";
    const now = new Date();

    await db.$transaction([
      db.asset.update({
        where: { id: asset.id },
        data: {
          status: restored,
          previousStatus: null,
          statusReason: null,
          statusChangedAt: now,
        },
      }),
      db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "ASSET",
          action: "UNSUSPEND",
          targetAssetId: asset.id,
          reason: parsed.data.reason,
          previousStatus: "SUSPENDED",
          createdAt: now,
        },
      }),
    ]);

    revalidateModeration();
    revalidatePath(`/[locale]/assets/${asset.ref}`, "page");
    return actionOk({ assetId: asset.id });
  });
}

function revalidateModeration() {
  revalidatePath("/[locale]/moderation", "page");
  revalidatePath("/[locale]/moderation/participants", "page");
  revalidatePath("/[locale]/moderation/assets", "page");
  revalidatePath("/[locale]/moderation/audit", "page");
  revalidatePath("/[locale]/assets", "page");
  revalidatePath("/[locale]/buyers", "page");
  revalidatePath("/[locale]/dashboard", "page");
}
