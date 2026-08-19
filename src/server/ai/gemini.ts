import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/**
 * The single door to the language model.
 *
 * Three rules hold for every AI feature in this app, and they are enforced here
 * rather than at each call site:
 *
 *   1. **The key is optional.** `isAiEnabled()` is false without one and every
 *      caller has a deterministic path to fall back to. A reviewer running the
 *      app with no key gets a complete application, not a broken one.
 *   2. **The model proposes, zod disposes.** The same zod schema produces the
 *      JSON schema sent to the model AND validates what comes back, so a
 *      hallucinated country code or an invented licence type is dropped before
 *      it can reach a query.
 *   3. **It is bounded.** One attempt, a hard timeout, no retry loop. A slow or
 *      unhappy model degrades the feature; it must never hang the page.
 */

/**
 * Model choice, measured rather than assumed. Same prompt, two runs each:
 *
 *   gemini-3.1-flash-lite     0.7s / 1.4s   correct
 *   gemini-3-flash-preview    2.0s / 2.1s   correct, but a preview name
 *   gemini-flash-lite-latest  1.7s / 2.7s   wrapped the object in an array
 *   gemini-3.6-flash         22.4s / 27.3s  correct, and far too slow to type into
 *
 * All four extracted the same filters, including expanding "the Baltics" to
 * LT/LV/EE, so the decision came down to latency: a search box cannot wait 20
 * seconds. `thinkingLevel: "LOW"` did not help 3.6-flash (22.9s), and
 * `thinkingBudget: 0` is rejected outright by that model.
 *
 * Pinned to an exact version, not the floating "-latest" alias, so a model
 * rotation cannot change this app's behaviour after submission. (For the record:
 * gemini-2.5-flash was the first choice and is refused for recently created API
 * keys — the API answers 404, "no longer available to new users".)
 */
const MODEL = "gemini-3.1-flash-lite";
const TIMEOUT_MS = 8_000;

export function isAiEnabled(): boolean {
  return (process.env.GEMINI_API_KEY ?? "").trim() !== "";
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (apiKey === "") return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export type AiOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "disabled" | "timeout" | "invalid" | "error" };

/**
 * Ask the model for a value matching `schema`, or fail in a way the caller can
 * handle. Never throws.
 */
export async function generateStructured<S extends z.ZodType>({
  schema,
  systemInstruction,
  prompt,
}: {
  schema: S;
  systemInstruction: string;
  prompt: string;
}): Promise<AiOutcome<z.infer<S>>> {
  const ai = getClient();
  if (!ai) return { ok: false, reason: "disabled" };

  // AbortSignal.timeout rather than a manual setTimeout race: the request is
  // actually cancelled, instead of being left running while we stop waiting.
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        // One zod schema, two jobs: the contract handed to the model and the
        // validator applied to its answer.
        responseJsonSchema: toJsonSchema(schema),
        // Deterministic output: the same query should not filter differently on
        // a second try.
        temperature: 0,
        abortSignal: signal,
      },
    });

    const text = response.text;
    if (!text) return { ok: false, reason: "invalid" };

    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, reason: "invalid" };

    return { ok: true, data: parsed.data };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    if (!timedOut) {
      // Logged, never surfaced: an API error message can carry request details
      // that have no business reaching a browser.
      console.error("[ai] request failed", error);
    }

    return { ok: false, reason: timedOut ? "timeout" : "error" };
  }
}

/**
 * Gemini rejects several JSON Schema keywords that zod emits — `$schema`,
 * `additionalProperties` and the exclusive bounds among them — so the schema is
 * converted from zod once and then stripped of what the API will not accept.
 */
function toJsonSchema(schema: z.ZodType): unknown {
  return stripUnsupported(z.toJSONSchema(schema, { target: "draft-7", io: "output" }));
}

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "additionalProperties",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

function stripUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupported);
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = stripUnsupported(item);
  }
  return out;
}
