"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { MAX_PRICE_MINOR, parseMajorUnits } from "@/lib/money";
import {
  abort,
  actionFail,
  actionOk,
  requireActionRole,
  withAction,
  type ActionResult,
} from "@/lib/session";
import {
  BUSINESS_CATEGORIES,
  COUNTRY_CODES,
  CURRENCIES,
  LICENSE_TYPES,
} from "@/lib/vocabulary";

/**
 * The buyer's acquisition mandate.
 *
 * This is the buyer-side mirror of a listing, written in the same vocabulary, so
 * one matching function can compare the two. Creating and updating share a
 * schema and an upsert: a buyer has exactly one mandate, and "create" versus
 * "edit" is a UI distinction rather than a data one.
 */

const ticket = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const minor = parseMajorUnits(value);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: "That is not a valid amount." });
      return z.NEVER;
    }
    if (minor < 0n || minor > MAX_PRICE_MINOR) {
      ctx.addIssue({ code: "custom", message: "That amount is out of range." });
      return z.NEVER;
    }
    return minor;
  });

const mandateSchema = z
  .object({
    company: z.string().trim().min(2, "Enter the company or fund name.").max(120),
    country: z.enum(COUNTRY_CODES as [string, ...string[]], {
      message: "Choose where you are based.",
    }),
    thesis: z
      .string()
      .trim()
      .min(
        40,
        "Describe what you are looking for in at least 40 characters — this is what sellers read.",
      )
      .max(2000),
    about: z.string().trim().max(2000).optional().or(z.literal("")),
    targetCategories: z.array(z.enum(BUSINESS_CATEGORIES)).max(8).default([]),
    targetCountries: z
      .array(z.enum(COUNTRY_CODES as [string, ...string[]]))
      .max(32)
      .default([]),
    targetLicenseTypes: z.array(z.enum(LICENSE_TYPES)).max(8).default([]),
    ticketMin: ticket,
    ticketMax: ticket,
    currency: z.enum(CURRENCIES),
    needsActiveLicense: z.boolean().default(false),
    visibility: z.enum(["PUBLIC", "VERIFIED_ONLY", "HIDDEN"]),
  })
  // Checked after the fields parse, so the message lands on the range rather
  // than on one of the two numbers.
  .refine(
    (value) =>
      value.ticketMin === null ||
      value.ticketMax === null ||
      value.ticketMin <= value.ticketMax,
    { message: "The minimum ticket cannot be above the maximum.", path: ["ticketMin"] },
  );

export async function saveBuyerProfileAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const me = await requireActionRole("BUYER");

    const parsed = mandateSchema.safeParse({
      company: formData.get("company"),
      country: formData.get("country"),
      thesis: formData.get("thesis"),
      about: formData.get("about") ?? "",
      targetCategories: formData.getAll("targetCategories"),
      targetCountries: formData.getAll("targetCountries"),
      targetLicenseTypes: formData.getAll("targetLicenseTypes"),
      ticketMin: formData.get("ticketMin") ?? "",
      ticketMax: formData.get("ticketMax") ?? "",
      currency: formData.get("currency"),
      needsActiveLicense: formData.get("needsActiveLicense") === "on",
      visibility: formData.get("visibility"),
    });

    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        "Check the highlighted fields.",
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const data = parsed.data;

    const profile = await db.buyerProfile.upsert({
      where: { userId: me.id },
      create: {
        userId: me.id,
        company: data.company,
        country: data.country,
        thesis: data.thesis,
        about: data.about === "" ? null : (data.about ?? null),
        targetCategories: data.targetCategories,
        targetCountries: data.targetCountries,
        targetLicenseTypes: data.targetLicenseTypes,
        ticketMin: data.ticketMin,
        ticketMax: data.ticketMax,
        currency: data.currency,
        needsActiveLicense: data.needsActiveLicense,
        visibility: data.visibility,
      },
      update: {
        company: data.company,
        country: data.country,
        thesis: data.thesis,
        about: data.about === "" ? null : (data.about ?? null),
        targetCategories: data.targetCategories,
        targetCountries: data.targetCountries,
        targetLicenseTypes: data.targetLicenseTypes,
        ticketMin: data.ticketMin,
        ticketMax: data.ticketMax,
        currency: data.currency,
        needsActiveLicense: data.needsActiveLicense,
        visibility: data.visibility,
      },
      select: { id: true },
    });

    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/buyers", "page");

    return actionOk(profile);
  });
}

/**
 * Change only the visibility, from the dashboard, without reopening the form.
 * It is the setting a buyer flips most often — usually in a hurry, because a
 * competing process just started.
 */
export async function setBuyerVisibilityAction(
  formData: FormData,
): Promise<ActionResult<{ visibility: string }>> {
  return withAction(async () => {
    const me = await requireActionRole("BUYER");

    const visibility = z
      .enum(["PUBLIC", "VERIFIED_ONLY", "HIDDEN"])
      .safeParse(formData.get("visibility"));

    if (!visibility.success) abort("VALIDATION", "Unknown visibility setting.");

    const updated = await db.buyerProfile.updateMany({
      where: { userId: me.id },
      data: { visibility: visibility.data },
    });

    if (updated.count === 0) abort("NOT_FOUND", "Create your mandate first.");

    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/buyers", "page");

    return actionOk({ visibility: visibility.data });
  });
}
