/**
 * Aviso de «cliente sin margen de cargo» en la búsqueda de vuelos.
 *
 * Sin escalones tipo A ni pactos por aerolínea, el motor devuelve las tarifas a coste y no seleccionables
 * (`not_selectable_reason: 'pricing_incomplete:no_margin_configured'`) o ninguna. Antes el operador no veía por qué;
 * ahora se avisa al abrir el modal (con `margin` de `web_cargo_rate_sources`) y el texto de «no asignable» lo explica.
 */
import type { RateSourcesMargin } from "@cargo/services/rate_sources.service";

export const NO_MARGIN_REASON = "pricing_incomplete:no_margin_configured";

export interface MarginNotice {
  clientId: number;
  /** Mostrar el enlace «Configurar margen». */
  canConfigure: boolean;
}

/**
 * Aviso a mostrar ANTES de buscar, o null. Solo con `cargo_configured === false` explícito: un API antiguo (sin
 * `margin`) o un valor dudoso no avisan, para no alarmar sin motivo.
 */
export function marginNotice(margin: RateSourcesMargin | null | undefined): MarginNotice | null {
  if (!margin || margin.cargo_configured !== false) return null;
  const clientId = Number(margin.client_id) || 0;
  return { clientId, canConfigure: margin.can_configure === true && clientId > 0 };
}

/** ¿El motivo de «no seleccionable» es la falta de margen? (admite sufijos `:detalle`). */
export function isNoMarginReason(reason: string | null | undefined): boolean {
  return typeof reason === "string" && reason.startsWith(NO_MARGIN_REASON);
}

interface RateLike {
  selectable?: boolean;
  not_selectable_reason?: string | null;
}

/** Todas las tarifas recibidas están bloqueadas por falta de margen (false si no hay ninguna). */
export function allRatesWithoutMargin(rates: readonly RateLike[]): boolean {
  return (
    rates.length > 0 &&
    rates.every((r) => r.selectable === false && isNoMarginReason(r.not_selectable_reason))
  );
}

type Translate = (key: string) => string;

/**
 * Texto para una tarifa que el backend marcó no seleccionable. El motivo manda sobre el mensaje:
 *   - `quote_on_request[:MANUAL_LOAD_CHECK]`: el carrier no la tarifa solo; relanzar no sirve.
 *   - `pricing_incomplete:no_margin_configured`: falta el margen del cliente; relanzar tampoco sirve.
 *   - resto: genérico con el código técnico y la invitación a relanzar.
 */
export function notSelectableMessage(reason: string | null | undefined, t: Translate): string {
  const r = reason ?? "";
  if (r.startsWith("quote_on_request")) {
    return r.split(":")[1] === "MANUAL_LOAD_CHECK"
      ? t("cargo.flight.quote_manual_load_check")
      : t("cargo.flight.quote_on_request");
  }
  if (isNoMarginReason(r)) return t("cargo.flight.no_margin_not_selectable");
  return t("cargo.flight.rate_not_assignable") + (r ? ` (${r})` : "") + ". " + t("cargo.flight.relaunch_search");
}
