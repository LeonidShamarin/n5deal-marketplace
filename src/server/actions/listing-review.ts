"use server";

import { z } from "zod";

import { assetInputSchema } from "@/lib/asset-schema";
import { isPublishable, reviewListing, type ReviewIssue } from "@/lib/listing-review";
import {
  BENEFIT_LABELS,
  BUSINESS_STATUS_LABELS,
  CATEGORY_LABELS,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  countryName,
} from "@/lib/vocabulary";
import { formatMoney } from "@/lib/money";
import { requireActionRole } from "@/lib/session";
import { generateStructured, isAiEnabled } from "@/server/ai/gemini";

/**
 * Reviewing a listing draft before it goes live.
 *
 * The split is the same as everywhere else in this app: rules decide, the model
 * advises. `reviewListing` finds the contradictions that are checkable facts —
 * a licence type the jurisdiction does not issue, an operating business with no
 * staff — and runs with no key and no network. The model is then asked one
 * narrower question: reading this as a buyer, what is missing?
 *
 * The model's suggestions are capped, always land as "hint" severity, and can
 * never block publication. A hallucinated objection should cost the seller a
 * moment's reading, not a listing.
 */

const MAX_AI_SUGGESTIONS = 3;

export type ListingReviewResult = {
  issues: ReviewIssue[];
  publishable: boolean;
  aiUsed: boolean;
};

const aiSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        message: z
          .string()
          .min(15)
          .max(240)
          .describe("One concrete thing to add or clarify, addressed to the seller."),
      }),
    )
    .max(MAX_AI_SUGGESTIONS),
});

const SYSTEM_INSTRUCTION = `You review draft listings on a marketplace for regulated financial businesses and licences.

You are shown a complete draft. Name at most three concrete things the seller should add or clarify to make the listing credible to an acquirer.

Rules:
- Be specific to THIS draft. "Add more detail" is useless; "state whether the FCA permissions include safeguarding" is useful.
- Do not repeat information the draft already contains.
- Do not comment on price fairness — you cannot value the asset.
- Do not invent facts about the entity.
- If the draft is genuinely complete, return an empty list.`;

export async function reviewListingAction(input: unknown): Promise<ListingReviewResult> {
  // Reviewing a draft costs a model call, so it is behind the same role guard as
  // creating one — this endpoint is not an open text-generation service.
  await requireActionRole("SELLER");

  const parsed = assetInputSchema.safeParse(input);

  // A draft that does not even parse gets the schema's own errors. There is
  // nothing useful for a model to say about a missing licence type.
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<
      string,
      string[]
    >;
    const issues: ReviewIssue[] = Object.entries(fieldErrors).flatMap(
      ([field, messages]) =>
        (messages ?? []).map((message) => ({
          severity: "error" as const,
          field: field as ReviewIssue["field"],
          message,
        })),
    );
    return { issues, publishable: false, aiUsed: false };
  }

  const draft = parsed.data;
  const issues = reviewListing(draft);

  if (!isAiEnabled()) {
    return { issues, publishable: isPublishable(issues), aiUsed: false };
  }

  const outcome = await generateStructured({
    schema: aiSuggestionsSchema,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: describeDraft(draft),
  });

  if (!outcome.ok) {
    return { issues, publishable: isPublishable(issues), aiUsed: false };
  }

  const aiIssues: ReviewIssue[] = outcome.data.suggestions
    .slice(0, MAX_AI_SUGGESTIONS)
    .map((suggestion) => ({
      severity: "hint" as const,
      field: "description" as const,
      message: suggestion.message,
    }));

  return {
    issues: [...issues, ...aiIssues],
    // Deliberately computed from the rule-based issues only: the model does not
    // get a veto over publishing.
    publishable: isPublishable(issues),
    aiUsed: true,
  };
}

function describeDraft(draft: z.infer<typeof assetInputSchema>): string {
  const lines = [
    `Title: ${draft.title}`,
    `Category: ${CATEGORY_LABELS[draft.category]}`,
    `Licence: ${LICENSE_LABELS[draft.licenseType]} (${LICENSE_DESCRIPTIONS[draft.licenseType]})`,
    `Jurisdiction: ${countryName(draft.country)}`,
    `Regulator: ${draft.regulator || "not stated"}`,
    `Business status: ${BUSINESS_STATUS_LABELS[draft.businessStatus]}`,
    `Asking price: ${formatMoney(draft.askingPrice, draft.currency)}`,
    `Employees: ${draft.employees ?? "not stated"}`,
    `Year of issue: ${draft.yearOfIssue ?? "not stated"}`,
    `Included: ${
      draft.benefits.length > 0
        ? draft.benefits.map((b) => BENEFIT_LABELS[b]).join(", ")
        : "nothing listed"
    }`,
    "",
    "Description:",
    draft.description,
  ];

  return lines.join("\n");
}
