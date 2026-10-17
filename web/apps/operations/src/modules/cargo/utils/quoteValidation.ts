import type { QuoteDataIssue } from "@cargo/services/rate_sources.service";

type MessageParam = string | number;
type Translate = (key: string, params: Record<string, MessageParam>) => string;

const ISSUE_KEYS: Readonly<Record<string, string>> = {
  NO_PACKAGE_DETAIL: "cargo.quote_validation.NO_PACKAGE_DETAIL",
  NO_PACKAGES_COUNT: "cargo.quote_validation.NO_PACKAGES_COUNT",
  NO_WEIGHT: "cargo.quote_validation.NO_WEIGHT",
  MISSING_DIMENSIONS: "cargo.quote_validation.MISSING_DIMENSIONS",
  WEIGHT_MISMATCH: "cargo.quote_validation.WEIGHT_MISMATCH",
  PACKAGES_COUNT_MISMATCH: "cargo.quote_validation.PACKAGES_COUNT_MISMATCH",
  NO_ORIGIN: "cargo.quote_validation.NO_ORIGIN",
  NO_DESTINATION: "cargo.quote_validation.NO_DESTINATION",
};

function messageParams(
  detail?: Record<string, unknown>,
): Record<string, MessageParam> {
  const params: Record<string, MessageParam> = {};
  for (const [key, value] of Object.entries(detail ?? {})) {
    if (typeof value === "string" || typeof value === "number") {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Localise a quote-readiness issue from its stable backend code.
 *
 * `message` remains a compatibility fallback for codes introduced by the API
 * before their locale entries reach this frontend.
 */
export function translateQuoteIssue(
  issue: QuoteDataIssue,
  translate: Translate,
): string {
  const key = ISSUE_KEYS[issue.code];
  if (!key) return issue.message || issue.code;
  return translate(key, messageParams(issue.detail));
}
