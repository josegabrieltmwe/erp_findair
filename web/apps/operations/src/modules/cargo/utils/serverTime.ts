/**
 * Server-clock helpers.
 *
 * The browser's local clock can be wrong (dead CMOS battery, manually
 * skewed date), so any "is this date in the past?" check MUST use the
 * server time injected at page render (`window.__TMWE_CARGO__.serverDate`),
 * never `new Date()`. These helpers centralise that rule.
 *
 * `serverDate` is a `YYYY-MM-DD` string produced by PHP `date('Y-m-d')`.
 * If the bootstrap is missing it (older cached page), we fall back to the
 * client date — degraded but better than crashing.
 */

/** Authoritative "today" as `YYYY-MM-DD` (server date, client fallback). */
export function serverToday(): string {
  const injected =
    typeof window !== "undefined"
      ? window.__TMWE_CARGO__?.serverDate
      : undefined;
  if (injected && /^\d{4}-\d{2}-\d{2}$/.test(injected)) {
    return injected;
  }
  // Fallback: client local date in YYYY-MM-DD (no UTC shift).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * True when `date` (a `YYYY-MM-DD` string) is strictly before the server's
 * today. Empty/invalid input is NOT considered past (let other validators
 * handle "required"). Comparison is lexicographic, which is correct for the
 * zero-padded `YYYY-MM-DD` format.
 */
export function isPastDate(date: string | null | undefined): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < serverToday();
}
