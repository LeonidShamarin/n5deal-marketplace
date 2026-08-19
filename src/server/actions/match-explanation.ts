"use server";

import { z } from "zod";

import { requireActionUser } from "@/lib/session";
import { generateStructured, isAiEnabled } from "@/server/ai/gemini";

/**
 * Turn an already-computed match into a sentence.
 *
 * The model is given the factors and the score — it does not see the buyer, the
 * listing, or any figures beyond what the scorer already decided to state. That
 * is what keeps this feature from being able to invent a reason: it can only
 * rephrase findings that a pure function produced.
 *
 * Returns null when there is no key, when the model does not answer, or when the
 * answer fails validation. The caller already has the deterministic bullet list
 * on screen, so null costs the user nothing.
 */

const requestSchema = z.object({
  score: z.number().int().min(0).max(100),
  factors: z
    .array(z.object({ hit: z.boolean(), detail: z.string().min(1).max(300) }))
    .min(1)
    .max(10),
});

const responseSchema = z.object({
  explanation: z
    .string()
    .min(30)
    .max(420)
    .describe("Two or three sentences addressed to the person reading the dashboard."),
});

const SYSTEM_INSTRUCTION = `You write short match explanations for a marketplace of regulated financial businesses.

You are given a match score and the findings that produced it. Write two or three sentences that a dealmaker would find useful: lead with the strongest reason this is worth a conversation, then name the one thing that could stop it.

Rules:
- Use only the findings you are given. Do not invent facts, figures or names.
- Do not restate the score as a number; the reader can already see it.
- Plain professional English. No bullet points, no headings, no hedging filler.`;

export async function explainMatchAction(input: unknown): Promise<string | null> {
  // Behind the session guard: this is a model call, not a public endpoint.
  await requireActionUser();

  if (!isAiEnabled()) return null;

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return null;

  const { score, factors } = parsed.data;

  const outcome = await generateStructured({
    schema: responseSchema,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: [
      `Match score: ${score} out of 100.`,
      "",
      "Findings:",
      ...factors.map((f) => `- ${f.hit ? "MET" : "NOT MET"}: ${f.detail}`),
    ].join("\n"),
  });

  return outcome.ok ? outcome.data.explanation : null;
}
