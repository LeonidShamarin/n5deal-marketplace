"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssetStatus } from "@prisma/client";

import { assetInputFromFormData, assetInputSchema } from "@/lib/asset-schema";
import { db } from "@/lib/db";
import {
  abort,
  actionFail,
  actionOk,
  requireActionRole,
  withAction,
  type ActionResult,
} from "@/lib/session";

/**
 * Seller-side listing management.
 *
 * Two guards run on every mutation, in this order:
 *
 *   1. the caller holds the SELLER role;
 *   2. the row they are touching is theirs.
 *
 * The second is the one that matters. A seller who edits the hidden `assetId`
 * in the form gets a 403-equivalent failure, not someone else's listing — which
 * is why ownership is re-read from the database rather than taken from the
 * submitted form.
 */

/** Statuses a seller may move a listing into by themselves. */
const SELLER_SETTABLE: readonly AssetStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED", "SOLD"];

async function loadOwnAsset(assetId: string, sellerId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { id: true, ref: true, sellerId: true, status: true, publishedAt: true },
  });

  if (!asset) abort("NOT_FOUND", "That listing does not exist.");
  if (asset.sellerId !== sellerId) {
    abort("FORBIDDEN", "That listing belongs to another seller.");
  }
  // A listing a manager has suspended is frozen for its owner: letting the
  // seller edit their way out of moderation would make suspension meaningless.
  if (asset.status === "SUSPENDED") {
    abort("FORBIDDEN", "This listing is suspended by a platform manager and cannot be changed.");
  }

  return asset;
}

export async function createAssetAction(
  _prev: ActionResult<{ ref: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ ref: number }>> {
  return withAction(async () => {
    const me = await requireActionRole("SELLER");

    const parsed = assetInputSchema.safeParse(assetInputFromFormData(formData));
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        "Check the highlighted fields.",
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const publish = formData.get("intent") === "publish";
    const data = parsed.data;

    const asset = await db.asset.create({
      data: {
        sellerId: me.id,
        title: data.title,
        description: data.description,
        category: data.category,
        licenseType: data.licenseType,
        country: data.country,
        businessStatus: data.businessStatus,
        regulator: data.regulator === "" ? null : (data.regulator ?? null),
        askingPrice: data.askingPrice,
        currency: data.currency,
        employees: data.employees,
        yearOfIssue: data.yearOfIssue,
        benefits: data.benefits,
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? new Date() : null,
      },
      select: { ref: true },
    });

    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/assets", "page");

    return actionOk({ ref: asset.ref });
  });
}

export async function updateAssetAction(
  _prev: ActionResult<{ ref: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ ref: number }>> {
  return withAction(async () => {
    const me = await requireActionRole("SELLER");

    const assetId = String(formData.get("assetId") ?? "");
    if (assetId === "") abort("VALIDATION", "Missing listing reference.");

    const existing = await loadOwnAsset(assetId, me.id);

    const parsed = assetInputSchema.safeParse(assetInputFromFormData(formData));
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        "Check the highlighted fields.",
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const publish = formData.get("intent") === "publish";
    const data = parsed.data;

    const nextStatus: AssetStatus = publish ? "PUBLISHED" : existing.status;

    await db.asset.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        licenseType: data.licenseType,
        country: data.country,
        businessStatus: data.businessStatus,
        regulator: data.regulator === "" ? null : (data.regulator ?? null),
        askingPrice: data.askingPrice,
        currency: data.currency,
        employees: data.employees,
        yearOfIssue: data.yearOfIssue,
        benefits: data.benefits,
        status: nextStatus,
        // First publication stamps the date; re-publishing later keeps the
        // original, so "newest first" does not reward re-saving a listing.
        publishedAt: existing.publishedAt ?? (publish ? new Date() : null),
      },
    });

    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/assets", "page");
    revalidatePath(`/[locale]/assets/${existing.ref}`, "page");

    return actionOk({ ref: existing.ref });
  });
}

const statusSchema = z.object({
  assetId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "SOLD"]),
});

/** Publish, unpublish, archive or mark sold. */
export async function setAssetStatusAction(
  formData: FormData,
): Promise<ActionResult<{ status: AssetStatus }>> {
  return withAction(async () => {
    const me = await requireActionRole("SELLER");

    const parsed = statusSchema.safeParse({
      assetId: formData.get("assetId"),
      status: formData.get("status"),
    });
    if (!parsed.success) abort("VALIDATION", "Unknown status change.");

    const existing = await loadOwnAsset(parsed.data.assetId, me.id);
    const next = parsed.data.status;

    if (!SELLER_SETTABLE.includes(next)) {
      abort("FORBIDDEN", "Sellers cannot set that status.");
    }

    await db.asset.update({
      where: { id: existing.id },
      data: {
        status: next,
        publishedAt:
          next === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      },
    });

    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/assets", "page");
    revalidatePath(`/[locale]/assets/${existing.ref}`, "page");

    return actionOk({ status: next });
  });
}
