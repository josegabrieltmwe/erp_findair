/**
 * Strip HTML tags / entities from legacy text fields. The backend stores
 * descriptions like "<b>IT - Standard Domestic</b>" for `servizi_fornitori.descr`
 * (legacy used to render them inline) and the SPA needs the plain text.
 */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  const noTags = String(s).replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = noTags;
  return txt.value.trim();
}
