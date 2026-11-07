/**
 * Datos de contacto completados con la sede, el partner o TMWE (CONTACT_FALLBACK_*).
 *
 * El API no manda texto: manda `code` y `params` ({side, source, source_name}) y aquí se traduce con
 * `errors.api.<code>`, en el idioma del usuario. Nunca bloquea: es un aviso previo (prevalidación) y una
 * constancia posterior (tras generar la AWB).
 */
import type { ValidationIssue } from "@shipment/services/labels.service";

export interface ContactFallback {
  code: string;
  side: "origin" | "destination";
  source: "sede" | "partner" | "tmwe" | "none";
  source_name?: string;
  value?: string;
}

interface I18n {
  t: (key: string, named?: Record<string, unknown>) => string;
  te: (key: string) => boolean;
}

export function isContactFallbackCode(code?: string): boolean {
  return !!code && code.startsWith("CONTACT_FALLBACK_");
}

/** Texto traducido de un aviso de respaldo; null si no es de contacto o falta la traducción. */
export function contactFallbackText(
  code: string | undefined,
  params: Record<string, unknown> | undefined,
  i18n: I18n,
): string | null {
  if (!isContactFallbackCode(code)) return null;
  const p = params ?? {};
  const side = String(p.side ?? "destination") === "origin" ? "origin" : "destination";
  const source = String(p.source ?? "none");
  const none = source === "none" && i18n.te(`errors.api.${code}_NONE`);
  const key = none ? `errors.api.${code}_NONE` : `errors.api.${code}`;
  if (!i18n.te(key)) return null;
  const sideText = i18n.t(`errors.api.CONTACT_FALLBACK_SIDE_${side}`);
  const srcKey = `errors.api.CONTACT_FALLBACK_SRC_${source}`;
  const sourceText = i18n.te(srcKey) ? i18n.t(srcKey, { name: String(p.source_name ?? "") }) : "";
  return i18n.t(key, { side: sideText, source: sourceText, name: String(p.source_name ?? ""), value: String(p.value ?? "") });
}

/** `contact_fallbacks` de la respuesta de generar → avisos con la forma de la prevalidación. */
export function fallbacksToIssues(list: ContactFallback[] | undefined): ValidationIssue[] {
  return (list ?? []).map((f) => ({
    category: f.side === "origin" ? "sender" : "delivery",
    severity: "warning" as const,
    message: "",
    code: f.code,
    params: { side: f.side, source: f.source, source_name: f.source_name ?? "", value: f.value ?? "" },
  }));
}
