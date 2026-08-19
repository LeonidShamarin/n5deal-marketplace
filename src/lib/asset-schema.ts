import { z } from "zod";

import {
  ASSET_BENEFITS,
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  COUNTRY_CODES,
  CURRENCIES,
  LICENSE_TYPES,
} from "./vocabulary";
import { MAX_PRICE_MINOR, parseMajorUnits } from "./money";

/**
 * The listing form contract.
 *
 * It lives in `lib/` rather than beside the server action because the same
 * schema validates on both sides: the browser gets instant feedback, the server
 * treats the browser as untrusted and runs it again. Writing the rules twice is
 * how the two drift apart.
 */

const CURRENT_YEAR = new Date().getFullYear();

export const assetInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Give the listing a title of at least 10 characters.")
    .max(140, "Keep the title under 140 characters."),

  description: z
    .string()
    .trim()
    .min(60, "Describe the asset in at least 60 characters — buyers skip empty listings.")
    .max(4000, "Keep the description under 4000 characters."),

  category: z.enum(BUSINESS_CATEGORIES, { message: "Choose a business category." }),
  licenseType: z.enum(LICENSE_TYPES, { message: "Choose a licence type." }),
  country: z.enum(COUNTRY_CODES as [string, ...string[]], {
    message: "Choose a jurisdiction.",
  }),
  businessStatus: z.enum(BUSINESS_STATUSES, {
    message: "Say whether the business is operating or the licence is clean.",
  }),

  regulator: z.string().trim().max(80).optional().or(z.literal("")),

  // Money arrives as whatever the user typed and leaves as minor units. The
  // transform is where "2.5M" and "2 500 000" stop being different things.
  askingPrice: z
    .string()
    .trim()
    .min(1, "Enter an asking price.")
    .transform((value, ctx) => {
      const minor = parseMajorUnits(value);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: "That is not a valid amount." });
        return z.NEVER;
      }
      if (minor <= 0n) {
        ctx.addIssue({ code: "custom", message: "The asking price must be above zero." });
        return z.NEVER;
      }
      if (minor > MAX_PRICE_MINOR) {
        ctx.addIssue({ code: "custom", message: "That amount is implausibly large." });
        return z.NEVER;
      }
      return minor;
    }),

  currency: z.enum(CURRENCIES),

  employees: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100_000) {
        ctx.addIssue({ code: "custom", message: "Enter a whole number of employees." });
        return z.NEVER;
      }
      return parsed;
    }),

  yearOfIssue: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1970 || parsed > CURRENT_YEAR) {
        ctx.addIssue({
          code: "custom",
          message: `Enter a year between 1970 and ${CURRENT_YEAR}.`,
        });
        return z.NEVER;
      }
      return parsed;
    }),

  benefits: z.array(z.enum(ASSET_BENEFITS)).max(ASSET_BENEFITS.length).default([]),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

/**
 * Read the form into the shape the schema expects.
 *
 * Checkbox groups arrive as repeated keys, and every other field arrives as a
 * string — including the ones that are numbers, which is why the schema does its
 * own coercion instead of trusting `valueAsNumber`.
 */
export function assetInputFromFormData(formData: FormData): Record<string, unknown> {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    licenseType: formData.get("licenseType"),
    country: formData.get("country"),
    businessStatus: formData.get("businessStatus"),
    regulator: formData.get("regulator") ?? "",
    askingPrice: formData.get("askingPrice"),
    currency: formData.get("currency"),
    employees: formData.get("employees") ?? "",
    yearOfIssue: formData.get("yearOfIssue") ?? "",
    benefits: formData.getAll("benefits"),
  };
}
