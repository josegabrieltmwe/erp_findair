/**
 * Strip HTML markup from a legacy carrier/airline name string.
 *
 * Legacy `presa_ajax_cargo2.php` builds the picked-rate label by
 * concatenating the airline name with an HTML <span> that holds the
 * product + service code, e.g.:
 *
 *   "Amerijet International <span style='color:#0000FF;...'>(General Lowerdeck GEN)</span>"
 *
 * That string ends up persisted verbatim in `spedizioni_cargo.vettore_nome`.
 * The legacy SPA rendered it with innerHTML; the Vue SPA uses `{{ }}`
 * interpolation (escaped), which leaks the markup as literal text.
 *
 * Per project rule [[feedback_no_legacy_changes]] we don't touch the
 * legacy writer or the column — instead we sanitize at the presentation
 * boundary. The function is intentionally permissive: it accepts the
 * already-clean modern values unchanged.
 */
export function stripCarrierMarkup(input: unknown): string {
  if (input === null || input === undefined) return "";
  const raw = String(input);
  if (!raw) return "";
  if (!/[<&]/.test(raw)) return raw.trim();

  const noTags = raw.replace(/<[^>]*>/g, " ");
  const decoded = noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return decoded.replace(/\s+/g, " ").trim();
}
