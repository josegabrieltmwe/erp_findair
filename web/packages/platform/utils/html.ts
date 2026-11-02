/**
 * Conversión texto plano ↔ HTML sencillo (saltos de línea como <br>) y
 * validación de enlaces. El texto que escribe una persona nunca debe llegar
 * como HTML sin escapar: va al correo y a la oferta pública del cliente.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function plainToHtml(s: string): string {
  return escapeHtml(s).replace(/\r\n|\r|\n/g, "<br>");
}

export function htmlToPlain(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

const SAFE_LINK = /^(https?:|mailto:)/i;

/**
 * Devuelve la URL si usa http, https o mailto; en otro caso null
 * (`javascript:`, `data:`, etc.). Una URL sin esquema se toma como https.
 */
export function safeLinkUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (SAFE_LINK.test(url)) return url;
  // «algo:» como esquema desconocido se rechaza; «ejemplo.com/ruta» no.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[^/]*\.[^/]*:\d+/.test(url)) {
    return null;
  }
  return `https://${url}`;
}
