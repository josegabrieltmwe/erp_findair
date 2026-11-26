/**
 * Lógica pura del panel «Cobrar postfacturación» (`BookingPostchargePanel.vue`, P148): cuándo se puede iniciar, colores
 * de estado, importes con el idioma de la interfaz y clasificación de errores. Sin Vue ni red (ver
 * bookingPostchargeModel.spec.ts).
 *
 * Quién paga con tarjeta: el ERP no tiene la política de pago del cliente (`CARD_REQUIRED` solo la publica
 * `api_self_registration_status`, y solo para la persona del token) y el GET de `api_booking_postcharge` devuelve `null`
 * tanto si el cliente paga con tarjeta y aún no hay postfacturación como si se factura de la forma habitual. Por eso:
 *  - si el GET trae una postfacturación, el cliente paga con tarjeta (solo existen para esos clientes) y se muestra;
 *  - si no, se ofrece el botón y un 409 `NOT_CARD_CUSTOMER` se explica («usa la postfacturación habitual») y se recuerda
 *    por cliente durante la sesión para no volver a ofrecerlo. Petición al API para afinarlo: P149.
 */
import { ApiError } from "@shared/anagrafiche/services/api.types";
import type { BookingPostchargeStatus } from "@shared/payment_gateways/services/paymentGateways.service";
import { codeOf } from "./surchargesModel";

/** Lo que el envío ya dice de su facturación (campos del detalle express o cargo). */
export interface PostchargeShipmentState {
  /** `id_fattura_a`: primera factura del cliente. */
  invoiceId?: string | number | null;
  /** `id_fattura_a2`: postfactura (2ª factura). */
  postInvoiceId?: string | number | null;
  /** Importe pendiente de postfacturar: express `postfatt` + `giac_ric_postfatt`; cargo `carico_extra`. */
  postAmount?: number | null;
}

/** Motivo por el que el botón está deshabilitado; `null` si se puede iniciar. */
export type PostchargeBlock = "not_invoiced" | "post_billed" | "no_amount";

function positiveId(v: string | number | null | undefined): boolean {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0;
}

/**
 * Pista de UX con las mismas reglas que `Booking_Postcharge_Service::start()` (que decide de verdad y responde 409/422):
 * hace falta la primera factura, no tener la segunda y un importe mayor que 0.
 */
export function postchargeBlock(
  s: PostchargeShipmentState,
): PostchargeBlock | null {
  if (!positiveId(s.invoiceId)) return "not_invoiced";
  if (positiveId(s.postInvoiceId)) return "post_billed";
  const amount = Number(s.postAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "no_amount";
  return null;
}

/** Suma de importes que llegan como texto o número (`"13.00"`); lo que no es número cuenta 0. */
export function sumAmounts(
  ...values: Array<string | number | null | undefined>
): number {
  let cents = 0;
  for (const v of values) {
    const n = Number(v ?? 0);
    if (Number.isFinite(n)) cents += Math.round(n * 100);
  }
  return cents / 100;
}

/** Color del chip de estado. */
export function postchargeStatusColor(
  status: BookingPostchargeStatus | string,
): string {
  switch (status) {
    case "paid":
    case "invoiced":
      return "success";
    case "charged":
    case "notified":
      return "info";
    case "awaiting_payment":
    case "disputed":
      return "warning";
    case "invoice_pending":
      return "error";
    case "waived":
      return "grey";
    default:
      return "default";
  }
}

/** Importe en euros (texto del API, `"23.79"`) con el formato del idioma de la interfaz: «23,79 €», «€23.79». */
export function formatPostchargeAmount(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string {
  const n = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(n)
  )
    return "—";
  const cur = (currency || "EUR").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
    }).format(n);
  } catch {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${cur}`;
  }
}

/** Errores del panel, cada uno con su texto (`payments.postcharge.errors.<tipo>`). */
export type PostchargeErrorKind =
  | "not_card" // 409 NOT_CARD_CUSTOMER
  | "not_invoiced" // 409 NOT_INVOICED
  | "already_postbilled" // 409 ALREADY_POSTBILLED
  | "no_amount" // 422 NO_POST_AMOUNT
  | "preview_failed" // 422 POSTCHARGE_PREVIEW_FAILED
  | "invalid" // 422 PAYMENT_INVALID y resto de 422/400
  | "invoice_failed" // 502 POSTCHARGE_INVOICE_FAILED
  | "forbidden" // 403
  | "not_found" // 404
  | "conflict" // 409 sin code conocido
  | "other";

/** Clasifica un error de `api_booking_postcharge`. El code afina; uno desconocido cae en el genérico de su estado. */
export function classifyPostchargeError(err: unknown): PostchargeErrorKind {
  if (!(err instanceof ApiError)) return "other";
  const code = codeOf(err);
  switch (code) {
    case "NOT_CARD_CUSTOMER":
      return "not_card";
    case "NOT_INVOICED":
      return "not_invoiced";
    case "ALREADY_POSTBILLED":
      return "already_postbilled";
    case "NO_POST_AMOUNT":
      return "no_amount";
    case "POSTCHARGE_PREVIEW_FAILED":
      return "preview_failed";
    case "POSTCHARGE_INVOICE_FAILED":
      return "invoice_failed";
    default:
      break;
  }
  switch (err.status) {
    case 400:
    case 422:
      return "invalid";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    default:
      return "other";
  }
}

/**
 * Clientes que el API ya dijo que NO pagan con tarjeta (409 `NOT_CARD_CUSTOMER`) en esta sesión: el panel deja de
 * ofrecerles el botón. Solo memoria de la pestaña; recargar la página lo vacía (por si la política cambió).
 */
const standardCustomers = new Set<number>();

export function rememberStandardCustomer(
  customerId: number | null | undefined,
): void {
  if (customerId && customerId > 0) standardCustomers.add(customerId);
}

export function isKnownStandardCustomer(
  customerId: number | null | undefined,
): boolean {
  return !!customerId && standardCustomers.has(customerId);
}

/** Solo para pruebas. */
export function forgetStandardCustomers(): void {
  standardCustomers.clear();
}
