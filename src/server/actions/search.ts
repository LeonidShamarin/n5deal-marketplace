"use server";

import { z } from "zod";

import { aiFilterSchema, type AiFilterProposal } from "@/lib/filters";
import { parseNaturalQuery, proposalIsEmpty } from "@/lib/nl-query";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  COUNTRIES,
  LICENSE_DESCRIPTIONS,
  LICENSE_TYPES,
} from "@/lib/vocabulary";
import { generateStructured, isAiEnabled } from "@/server/ai/gemini";

/**
 * Natural language to catalogue filters.
 *
 * The pipeline is deliberately layered so that the feature never has a state
 * where it does nothing:
 *
 *   1. The deterministic parser runs first and always. It alone is enough to
 *      turn "EMI in Lithuania under 2M" into real filters with no API key.
 *   2. If a key is configured, the model runs on the same sentence and its
 *      answer is validated against the identical zod schema.
 *   3. The two are merged, with the model filling gaps rather than overruling
 *      the rules — anything the rules matched literally in the text is more
 *      trustworthy than a paraphrase.
 *
 * Whatever happens, the caller receives a proposal it can apply, plus a note
 * about which path produced it, so the UI can be honest with the user.
 */

const requestSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export type NlSearchResult = {
  proposal: AiFilterProposal;
  /**
   * Which layer produced the answer, and — when the model did not — why.
   * The UI shows this verbatim, so "no key configured" must never be said about
   * a configured key whose model call simply failed.
   */
  source: "ai" | "rules-no-key" | "rules-ai-unavailable";
  /** True when nothing structured was found and only free text remains. */
  weak: boolean;
};

const SYSTEM_INSTRUCTION = `You convert a marketplace search sentence into structured filters for a marketplace of regulated financial businesses and licences.

Rules:
- Only use values from the allowed lists. Never invent a country code, category or licence type.
- Prices are in whole EUR (major units), as integers. "2M" is 2000000.
- Omit any field the sentence does not clearly imply. Guessing is worse than leaving a filter off.
- "q" carries only leftover words that are not covered by the structured fields, such as a company name. Leave it out if there are none.`;

export async function parseSearchQueryAction(input: unknown): Promise<NlSearchResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { proposal: {}, source: "rules-no-key", weak: true };
  }

  const query = parsed.data.query;

  // Layer 1 — always.
  const rules = parseNaturalQuery(query);

  if (!isAiEnabled()) {
    return { proposal: rules, source: "rules-no-key", weak: proposalIsEmpty(rules) };
  }

  // Layer 2 — best effort.
  const outcome = await generateStructured({
    schema: aiFilterSchema,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: buildPrompt(query),
  });

  if (!outcome.ok) {
    // The key exists but the model did not answer — a timeout, a quota, or a
    // model that was retired out from under us. Same fallback, different story.
    return {
      proposal: rules,
      source: "rules-ai-unavailable",
      weak: proposalIsEmpty(rules),
    };
  }

  const merged = mergeProposals(rules, outcome.data);
  return { proposal: merged, source: "ai", weak: proposalIsEmpty(merged) };
}

function buildPrompt(query: string): string {
  const countries = COUNTRIES.map((c) => `${c.code} (${c.name})`).join(", ");
  const licences = LICENSE_TYPES.map((l) => `${l} (${LICENSE_DESCRIPTIONS[l]})`).join(
    ", ",
  );

  return [
    `Search sentence: ${JSON.stringify(query)}`,
    "",
    `Allowed categories: ${BUSINESS_CATEGORIES.join(", ")}`,
    `Allowed licence types: ${licences}`,
    `Allowed business statuses: ${BUSINESS_STATUSES.join(", ")} (LICENSE_ONLY means a clean licence with no operations)`,
    `Allowed country codes: ${countries}`,
  ].join("\n");
}

/**
 * Union the two proposals.
 *
 * Set-valued fields are unioned so the model can broaden a jurisdiction list
 * ("Baltics" → LT, LV, EE) that the rules could not know about. Price bounds are
 * taken from the rules when present, because a number written in the sentence is
 * a fact, not an interpretation.
 */
function mergeProposals(rules: AiFilterProposal, ai: AiFilterProposal): AiFilterProposal {
  const union = <T extends string>(a?: T[], b?: T[]): T[] | undefined => {
    const values = [...new Set([...(a ?? []), ...(b ?? [])])];
    return values.length > 0 ? values : undefined;
  };

  return {
    categories: union(rules.categories, ai.categories),
    countries: union(rules.countries, ai.countries),
    licenseTypes: union(rules.licenseTypes, ai.licenseTypes),
    businessStatuses: union(rules.businessStatuses, ai.businessStatuses),
    priceMinMajor: rules.priceMinMajor ?? ai.priceMinMajor ?? undefined,
    priceMaxMajor: rules.priceMaxMajor ?? ai.priceMaxMajor ?? undefined,
    // When the model answered, its `q` wins — it was told that the field holds
    // only leftovers, and it knows which words it turned into filters. The rules
    // cannot know that: they left "Baltics" in the free text, which then matched
    // no title and emptied a result set the filters had got right.
    q: ai.q,
  };
}
