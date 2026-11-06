import type { OtpFailure } from "@tmwe/shared-frontend/http";
import type { CarrierCharge, CarrierOfferView } from "@cargo/services/carrier_offer.service";

/**
 * Lógica pura de la vista de la aerolínea (sin Vue): qué aviso mostrar, cómo se nombra cada tipo de cargo, cómo se limpia
 * la nota del operador. Aparte de la página para poder probarla y reutilizarla en la fase de respuesta.
 */

export type BannerKind = "info" | "warning";

export interface Banner {
  kind: BannerKind;
  /** Clave i18n bajo `cargo.carrierOffer.`. */
  key: string;
}

/** Aviso de estado: una solicitud abierta no lleva ninguno; respondida avisa de que aún se puede cambiar; revisada, que está cerrada. */
export function bannerFor(view: Pick<CarrierOfferView, "state">): Banner | null {
  if (view.state === "locked") return { kind: "warning", key: "banner_locked" };
  if (view.state === "answered") return { kind: "info", key: "banner_answered" };
  return null;
}

/** Clave i18n del tipo de cargo (`kg`, `fix`, `box`); los desconocidos se muestran tal cual, vacíos como «—». */
export function chargeTypeKey(type: string | null | undefined): string | null {
  return type === "kg" || type === "fix" || type === "box" ? `type_${type}` : null;
}

/** Importe del API (cadena o número, `0`/`9999999` = «sin valor») para mostrar: «—» si no hay. */
export function chargeAmount(value: string | number | null | undefined, opts: { maxSentinel?: boolean } = {}): string {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n) || n === 0) return "—";
  if (opts.maxSentinel && n >= 9999999) return "—";
  return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoney(value: number, currency: string): string {
  return `${Number(value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** Líneas de coste con importe propio de la aerolínea ya informado (sus columnas «V»): para marcarlas en la tabla. */
export function hasOwnValue(charge: CarrierCharge): boolean {
  return [charge.costo_unitV, charge.costo_minV, charge.costo_maxV].some((v) => Number(v) > 0);
}

/**
 * La nota del operador llega como texto con `<br>` (así la guardaba el legado). Se muestra como TEXTO, nunca como HTML: los
 * saltos se conservan y cualquier otra etiqueta se descarta.
 */
export function plainNote(note: string | null | undefined): string {
  return String(note ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/** Fecha «2026-11-05 10:00:00» del API como «5 Nov 2026»; vacía o «0000-00-00» → ''. */
export function shortDate(value: string | null | undefined): string {
  if (!value || value.startsWith("0000")) return "";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export interface FailureText {
  title: string;
  message: string;
  retry: boolean;
}

/** Claves i18n (bajo `cargo.carrierOffer.error_`) de cada motivo por el que no hay vista. */
export function failureKeys(reason: OtpFailure | "not_found" | "session_lost"): { title: string; message: string; retry: boolean } {
  switch (reason) {
    case "locked":
      return { title: "error_locked_title", message: "error_locked_message", retry: false };
    case "unavailable":
      return { title: "error_unavailable_title", message: "error_unavailable_message", retry: true };
    case "in_use":
      return { title: "error_in_use_title", message: "error_in_use_message", retry: false };
    case "expired":
    case "session_lost":
      return { title: "error_expired_title", message: "error_expired_message", retry: false };
    default:
      // «invalid» y «not_found»: el mismo texto a propósito, como el BFF y el API (no hay oráculo de existencia).
      return { title: "error_invalid_title", message: "error_invalid_message", retry: false };
  }
}
