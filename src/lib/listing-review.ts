import type { AssetInput } from "./asset-schema";
import {
  BENEFIT_LABELS,
  LICENSE_LABELS,
  LICENSES_BY_COUNTRY,
  countryName,
} from "./vocabulary";

/**
 * Rule-based review of a listing draft.
 *
 * This is the deterministic half of the "smart validation" feature. It catches
 * the contradictions that are facts rather than opinions — an EMI in a country
 * that does not issue EMI licences, an operating business with no staff, a
 * licence dated in the future — and it runs with no API key, no network and no
 * latency.
 *
 * The model's job is the other half: reading the prose and suggesting what a
 * buyer would want added. It cannot overrule anything here.
 */

export type ReviewSeverity = "error" | "warning" | "hint";

export type ReviewIssue = {
  severity: ReviewSeverity;
  /** Which form field the issue points at, when it points at one. */
  field?: keyof AssetInput;
  message: string;
};

const MIN_PLAUSIBLE_PRICE_MAJOR: Partial<Record<AssetInput["licenseType"], number>> = {
  BANK: 1_000_000,
  EMI: 100_000,
  API_LICENSE: 50_000,
};

export function reviewListing(input: AssetInput): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const currentYear = new Date().getFullYear();

  // --- Jurisdiction vs licence type --------------------------------------
  const offered = LICENSES_BY_COUNTRY[input.country];
  if (offered && !offered.includes(input.licenseType)) {
    issues.push({
      severity: "error",
      field: "licenseType",
      message: `${countryName(input.country)} does not issue a ${LICENSE_LABELS[input.licenseType]} licence. Buyers checking the register will stop here — confirm the jurisdiction or the licence type.`,
    });
  }

  // --- Operating business consistency ------------------------------------
  if (input.businessStatus === "ACTIVE") {
    if (input.employees === null || input.employees === 0) {
      issues.push({
        severity: "warning",
        field: "employees",
        message:
          "The listing says the business is operating but names no staff. An operating entity with zero employees reads as a licence-only sale.",
      });
    }
    if (!input.benefits.includes("CLIENT_BASE")) {
      issues.push({
        severity: "hint",
        field: "benefits",
        message:
          "Operating businesses usually sell on their client base. If one transfers, say so — it is often the whole reason for the price.",
      });
    }
  }

  if (input.businessStatus === "LICENSE_ONLY" && (input.employees ?? 0) > 5) {
    issues.push({
      severity: "warning",
      field: "businessStatus",
      message:
        "A licence-only sale with more than five employees is unusual. Confirm whether the team actually transfers.",
    });
  }

  // --- Dates --------------------------------------------------------------
  if (input.yearOfIssue !== null && input.yearOfIssue > currentYear) {
    issues.push({
      severity: "error",
      field: "yearOfIssue",
      message: "The licence cannot have been issued in the future.",
    });
  }

  // --- Price plausibility -------------------------------------------------
  const floor = MIN_PLAUSIBLE_PRICE_MAJOR[input.licenseType];
  if (floor !== undefined && input.askingPrice < BigInt(floor) * 100n) {
    issues.push({
      severity: "warning",
      field: "askingPrice",
      message: `A ${LICENSE_LABELS[input.licenseType]} licence below ${floor.toLocaleString("en")} ${input.currency} is far under market. Check the figure — a typo here costs you serious buyers.`,
    });
  }

  // --- Completeness -------------------------------------------------------
  if (!input.regulator) {
    issues.push({
      severity: "warning",
      field: "regulator",
      message:
        "No regulator named. It is the first thing a buyer verifies, and its absence reads as evasive.",
    });
  }

  if (input.benefits.length === 0) {
    issues.push({
      severity: "warning",
      field: "benefits",
      message: `Nothing is listed as included. Even a clean licence usually comes with something — ${BENEFIT_LABELS.BANK_ACCOUNTS.toLowerCase()} or ${BENEFIT_LABELS.SOFTWARE.toLowerCase()}, for instance.`,
    });
  }

  if (input.yearOfIssue === null) {
    issues.push({
      severity: "hint",
      field: "yearOfIssue",
      message: "Buyers filter on licence age. Adding the year of issue makes the listing findable.",
    });
  }

  const words = input.description.trim().split(/\s+/).length;
  if (words < 40) {
    issues.push({
      severity: "hint",
      field: "description",
      message: `The description is ${words} words. Listings that explain why the asset is being sold, and what the buyer inherits, get materially more enquiries.`,
    });
  }

  return issues;
}

/** True when nothing blocks publication — warnings and hints do not. */
export function isPublishable(issues: ReviewIssue[]): boolean {
  return !issues.some((issue) => issue.severity === "error");
}
