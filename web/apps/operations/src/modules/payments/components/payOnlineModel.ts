/**
 * Lógica pura del cobro online con tarjeta (Checkout alojado de Stripe): validación del importe, clave de
 * idempotencia, clasificación de errores de `api_pay_payments` y reglas del sondeo de estado. Sin Vue ni red para
 * poder probarla aislada (ver payOnlineModel.spec.ts). El diálogo es `PayOnlineDialog.vue`.
 */
import { ApiError } from "@shared/anagrafiche/services/api.types";
import { hasScope, type AccessSnapshot } from "@shared/composables/useAccess";
import type { PayPaymentStatus } from "@shared/payment_gateways/services/paymentGateways.service";

/** Scope que habilita iniciar un cobro online (solo UX; la API autoriza cada petición). */
export const PAY_ONLINE_SCOPE = "payment_gateways:write";

/**
 * ¿Puede la persona cobrar online? Se deriva del scope `payment_gateways:write` del token y no de las capacidades de
 * facturación: cobrar con pasarela es un módulo distinto del registro contable manual.
 */
export function canPayOnline(access: AccessSnapshot): boolean {
  return hasScope(access, PAY_ONLINE_SCOPE);
}

export type PayAmountError = "required" | "invalid" | "not_positive" | "exceeds" | null;

/**
 * Convierte lo escrito por la persona en texto decimal con 2 decimales ("12.5" o "12,5" -> "12.50"), que es lo que
 * exige la API (nunca un número flotante). Devuelve null si no es un importe con a lo sumo 2 decimales.
 */
export function normalizeAmount(input: string | number | null | undefined): string | null {
  const raw = String(input ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [int, dec = ""] = raw.split(".");
  return `${int.replace(/^0+(?=\d)/, "")}.${dec.padEnd(2, "0")}`;
}

/** Importe a unidades menores (céntimos) sin errores de coma flotante; null si el texto no es válido. */
export function toMinor(input: string | number | null | undefined): number | null {
  const n = normalizeAmount(input);
  return n === null ? null : Number(n.replace(".", ""));
}

/**
 * Valida el importe a cobrar contra lo pendiente de la factura: obligatorio, bien formado, mayor que cero y sin
 * superar lo pendiente. Se compara en céntimos para no depender del redondeo.
 */
export function validatePayAmount(
  input: string | number | null | undefined,
  pending: number,
): PayAmountError {
  if (String(input ?? "").trim() === "") return "required";
  const minor = toMinor(input);
  if (minor === null) return "invalid";
  if (minor <= 0) return "not_positive";
  if (minor > Math.round(pending * 100)) return "exceeds";
  return null;
}

/**
 * Importe que viaja en la petición: `undefined` si es todo lo pendiente (la API lo calcula y evita desfases) o el
 * texto decimal normalizado si es un cobro parcial.
 */
export function amountForRequest(
  mode: "full" | "partial",
  input: string | number | null | undefined,
  pending: number,
): string | undefined {
  if (mode === "full") return undefined;
  const n = normalizeAmount(input);
  if (n === null) return undefined;
  return toMinor(n) === Math.round(pending * 100) ? undefined : n;
}

/**
 * Genera la clave de idempotencia de UN intento de cobro. Se crea al abrir el diálogo (o al cambiar el importe) y se
 * reutiliza en los reintentos de la misma petición: así un doble clic o un corte de red no duplican el cobro.
 */
export function newIdempotencyKey(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `erp-pay-${uuid}`;
}

export type PayErrorKind =
  | "declined"
  | "conflict"
  | "invalid"
  | "not_active"
  | "forbidden"
  | "other";

export interface PayErrorInfo {
  kind: PayErrorKind;
  /** Código de la API (`error_code`), si lo trae. */
  code?: string;
}

/** Código de negocio del cuerpo del error: `ApiError.code` solo lo trae en 4xx; en 5xx hay que leer el cuerpo. */
function codeOf(err: ApiError): string | undefined {
  const body = err.details as
    | { error_code?: unknown; code?: unknown; error?: { code?: unknown } }
    | undefined;
  for (const c of [body?.error_code, body?.error?.code, body?.code, err.code]) {
    if (typeof c === "string" && c) return c;
  }
  return undefined;
}

/**
 * Agrupa los errores del contrato de `api_pay_payments` para elegir el mensaje: 402 rechazo, 409 conflicto (clave
 * repetida con otra petición, nada pendiente o factura ocupada), 422 validación, 503 con
 * `PAYMENT_GATEWAYS_NOT_ACTIVE` (pasarela sin activar). Cualquier otro caso es `other`.
 */
export function classifyPayError(err: unknown): PayErrorInfo {
  if (!(err instanceof ApiError)) return { kind: "other" };
  const code = codeOf(err);
  switch (err.status) {
    case 402:
      return { kind: "declined", code };
    case 409:
      return { kind: "conflict", code };
    case 422:
      return { kind: "invalid", code };
    case 403:
      return { kind: "forbidden", code };
    case 503:
      return code === "PAYMENT_GATEWAYS_NOT_ACTIVE"
        ? { kind: "not_active", code }
        : { kind: "other", code };
    default:
      return { kind: "other", code };
  }
}

/** Estados en los que el cobro ya no cambiará: se deja de sondear. */
const TERMINAL: ReadonlySet<string> = new Set(["succeeded", "failed", "canceled", "expired"]);

export function isTerminalStatus(status: PayPaymentStatus | null | undefined): boolean {
  return !!status && TERMINAL.has(status);
}

/**
 * Solo se abre una `checkout_url` https: la URL viene de la API, pero se valida antes de navegar a ella para no
 * ejecutar nunca un esquema `javascript:` o `data:` por un dato inesperado.
 */
export function isSafeCheckoutUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Intervalo del sondeo en ms: 3 s los primeros intentos y 8 s después, para no castigar a la API. */
export function pollDelay(attempt: number): number {
  return attempt < 10 ? 3000 : 8000;
}

/** Máximo de consultas antes de dejar de sondear (unos 7 minutos); la persona puede refrescar a mano. */
export const POLL_MAX_ATTEMPTS = 60;

/** ¿La sesión de Checkout ya caducó? Sin fecha se asume vigente. */
export function isCheckoutExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}
