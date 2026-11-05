/**
 * Lógica pura de las pantallas de RECARGOS (`SurchargesPage.vue`, `SurchargeProposeDialog.vue`,
 * `SurchargeReasonDialog.vue`): permisos de UX, acciones disponibles por estado, importes en céntimos, validación de la
 * propuesta y clasificación de errores. Sin Vue ni red, para probarla aislada (ver surchargesModel.spec.ts).
 *
 * Contrato de la API (`api_pay_surcharges`): docs/contrato-con-api.md. Principios que esta capa respeta:
 *  - El importe viaja como ENTERO en céntimos (`amount_minor`); nunca como decimal ni por coma flotante. Lo que escribe
 *    la persona ("42,50") se convierte con `eurosToMinor`, que trabaja sobre el texto.
 *  - Los scopes solo deciden qué se MUESTRA; el API autoriza cada petición. Los botones administrativos (perdonar,
 *    rechazar impugnación, cobrar) exigen `payment_gateways:admin` y, además, ser TMWE o `partner:manage`: eso último lo
 *    comprueba el servidor (403 `PAYMENT_FORBIDDEN`) y la pantalla lo explica, no lo adivina.
 *  - Un recargo de otro partner responde 404 incluso a TMWE (independencia del partner): no hay vista cruzada, así que
 *    esta capa no ofrece filtro de partner y trata el 404 como «no existe para ti».
 *  - Todo está apagado por defecto en el servidor: 503 `PAYMENT_NOT_ACTIVE` es un estado esperado, no una avería.
 */
import { ApiError } from "@shared/anagrafiche/services/api.types";
import { hasScope, type AccessSnapshot } from "@shared/composables/useAccess";
import type {
  PaySurcharge,
  PaySurchargeStatus,
  PaySurchargeType,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { toMinor } from "./payOnlineModel";

/** Scope para VER recargos y autorizaciones (personal y partner). */
export const SURCHARGE_READ_SCOPE = "payment_gateways:read";
/** Scope para proponer, avisar, impugnar en nombre del cliente y dar de alta/revocar autorizaciones. */
export const SURCHARGE_WRITE_SCOPE = "payment_gateways:write";
/** Scope de las acciones administrativas (perdonar, rechazar impugnación, cobrar). El API exige además TMWE o `partner:manage`. */
export const SURCHARGE_ADMIN_SCOPE = "payment_gateways:admin";

/** Filas por página de los listados (el API admite hasta 100). */
export const SURCHARGE_PER_PAGE = 25;

/** ¿Puede ver recargos y autorizaciones? */
export function canViewSurcharges(access: AccessSnapshot): boolean {
  return hasScope(access, SURCHARGE_READ_SCOPE);
}

/** ¿Puede proponer, avisar o impugnar en nombre del cliente, y gestionar autorizaciones? */
export function canWriteSurcharges(access: AccessSnapshot): boolean {
  return hasScope(access, SURCHARGE_WRITE_SCOPE);
}

/** ¿Se muestran los botones administrativos? Solo con el scope `payment_gateways:admin`. */
export function canAdminSurcharges(access: AccessSnapshot): boolean {
  return hasScope(access, SURCHARGE_ADMIN_SCOPE);
}

/** Acciones que la fila puede ofrecer. Cada una es un botón; las ausentes no se pintan. */
export type SurchargeAction = "notify" | "dispute" | "waive" | "reject_dispute" | "charge";

/** Marca de tiempo (ms) de una fecha de la API (`AAAA-MM-DD HH:MM:SS` o ISO); `null` si no hay o no se entiende. */
export function parseApiDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isFinite(t) ? t : null;
}

/** ¿Ya pasó el plazo de aviso (`notice_due_at`)? Sin fecha, no (nunca se avisó). Es solo una pista: el API decide (409). */
export function isNoticeElapsed(row: Pick<PaySurcharge, "notice_due_at">, now: number = Date.now()): boolean {
  const due = parseApiDate(row.notice_due_at);
  return due !== null && due <= now;
}

/** ¿Sigue abierto el plazo de impugnación (`dispute_until`)? Sin fecha, no. Pista de UX; el API responde 409 si cerró. */
export function isDisputeWindowOpen(row: Pick<PaySurcharge, "dispute_until">, now: number = Date.now()): boolean {
  const until = parseApiDate(row.dispute_until);
  return until !== null && until > now;
}

/**
 * Acciones disponibles para una fila según su estado y los permisos. Reglas (espejo de `Surcharge_Service`, que es quien
 * decide de verdad y responde 409 si no encajan):
 *  - `notify`: recargo propuesto (`pending_notice`); necesita `:write`.
 *  - `dispute` (en nombre del cliente): `notified` o `charged` con el plazo abierto; necesita `:write`.
 *  - `waive`: cualquier estado salvo `waived` e `invoiced`; necesita `:admin`.
 *  - `reject_dispute`: solo `disputed`; necesita `:admin`.
 *  - `charge`: `notified` o `failed` con el preaviso vencido; necesita `:admin`. El cobro además exige que el servidor
 *    tenga `PASARELAS_MODO` y `RECARGOS_MODO` en ACTIVO (503 en caso contrario: se explica, no se oculta el botón).
 */
export function availableActions(
  row: Pick<PaySurcharge, "status" | "notice_due_at" | "dispute_until">,
  access: AccessSnapshot,
  now: number = Date.now(),
): SurchargeAction[] {
  const write = canWriteSurcharges(access);
  const admin = canAdminSurcharges(access);
  const out: SurchargeAction[] = [];
  if (write && row.status === "pending_notice") out.push("notify");
  if (write && (row.status === "notified" || row.status === "charged") && isDisputeWindowOpen(row, now)) out.push("dispute");
  if (admin && row.status !== "waived" && row.status !== "invoiced") out.push("waive");
  if (admin && row.status === "disputed") out.push("reject_dispute");
  if (admin && (row.status === "notified" || row.status === "failed") && isNoticeElapsed(row, now)) out.push("charge");
  return out;
}

/** Color del chip de estado. */
export function statusColor(status: PaySurchargeStatus | string): string {
  switch (status) {
    case "charged":
    case "invoiced":
      return "success";
    case "failed":
      return "error";
    case "disputed":
      return "warning";
    case "notified":
      return "info";
    case "waived":
      return "grey";
    default:
      return "default"; // pending_notice y cualquier estado nuevo
  }
}

/**
 * Convierte lo escrito en euros ("42,50", "42.5", "42") a céntimos enteros, sin pasar por coma flotante. `null` si no es
 * un importe con a lo sumo 2 decimales. (Delegado en `toMinor` del cobro online: misma regla en todo el módulo.)
 */
export function eurosToMinor(input: string | number | null | undefined): number | null {
  return toMinor(input);
}

/** Céntimos a texto para mostrar, p. ej. 4200 -> "42,00 EUR". Solo presentación: el entero es la fuente. */
export function formatMinor(minor: number | null | undefined, currency = "EUR"): string {
  const n = Number(minor ?? 0);
  if (!Number.isFinite(n)) return "—";
  const euros = (n / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${euros} ${currency}`.trim();
}

/** Campos del formulario de propuesta tal como los escribe la persona. */
export interface ProposeForm {
  customerId: number | null;
  type: PaySurchargeType;
  /** Importe en euros como texto. */
  amount: string;
  declared: string;
  measured: string;
  evidence: string;
  carrierRef: string;
}

/** Claves de error de campo del formulario de propuesta (sufijo de `payments.surcharges.propose.errors.*`). */
export type ProposeFieldError = "customer" | "amount" | "declared" | "measured" | "evidence";

/**
 * Valida el formulario antes de enviarlo. Devuelve los campos con error (vacío = válido). `declared` y `measured` solo
 * son obligatorios en sobrepeso y oversize; la evidencia, siempre. Los topes (150 EUR por cobro, 500 EUR/mes) y que el
 * importe no supere lo que aceptó el cliente los valida el servidor (422 `SURCHARGE_CAP_EXCEEDED`): son parámetros
 * del vendedor y esta capa no los duplica.
 */
export function validateProposal(form: ProposeForm): ProposeFieldError[] {
  const errors: ProposeFieldError[] = [];
  if (!form.customerId || form.customerId <= 0) errors.push("customer");
  const minor = eurosToMinor(form.amount);
  if (minor === null || minor <= 0) errors.push("amount");
  const needsMeasures = form.type === "overweight" || form.type === "oversize";
  if (needsMeasures && form.declared.trim() === "") errors.push("declared");
  if (needsMeasures && form.measured.trim() === "") errors.push("measured");
  if (form.evidence.trim() === "") errors.push("evidence");
  return errors;
}

/** Tipos de error de las pantallas de recargos y autorizaciones, para elegir el mensaje. */
export type SurchargeErrorKind =
  | "not_active" // 503 PAYMENT_NOT_ACTIVE: interruptor apagado (esperado)
  | "return_url" // 503 PAYMENT_RETURN_URL_NOT_CONFIGURED
  | "forbidden" // 403 PAYMENT_FORBIDDEN u otro 403
  | "not_found" // 404: ajeno (TMWE incluido) o inexistente
  | "cap_exceeded" // 422 SURCHARGE_CAP_EXCEEDED
  | "currency" // 422 PAYMENT_UNSUPPORTED_CURRENCY
  | "invalid" // 422 resto
  | "notice_not_elapsed" // 409 SURCHARGE_NOTICE_NOT_ELAPSED
  | "dispute_closed" // 409 SURCHARGE_DISPUTE_WINDOW_CLOSED
  | "in_flight" // 409 SURCHARGE_PAYMENT_IN_FLIGHT
  | "invalid_state" // 409 PAYMENT_INVALID_STATE (incluye proponer sin autorización activa del cliente)
  | "authorization_exists" // 409 AUTHORIZATION_ALREADY_ACTIVE
  | "consent_stale" // 409 CONSENT_TEXT_NOT_CURRENT
  | "method_unavailable" // 409 PAYMENT_METHOD_NOT_AVAILABLE
  | "conflict" // 409 resto (incluida la clave de idempotencia repetida)
  | "other";

/** Código de negocio del error: `ApiError.code` o, si no, el del cuerpo problem+json. */
function codeOf(err: ApiError): string | undefined {
  const body = err.details as { error_code?: unknown; code?: unknown; error?: { code?: unknown } } | undefined;
  for (const c of [err.code, body?.error_code, body?.error?.code, body?.code]) {
    if (typeof c === "string" && c) return c;
  }
  return undefined;
}

/**
 * Agrupa los errores de `api_pay_surcharges` y `api_pay_authorizations` en un tipo con mensaje propio. El estado manda y el
 * code afina; un code desconocido cae en el genérico de su estado (nunca se muestra texto crudo del servidor).
 */
export function classifySurchargeError(err: unknown): SurchargeErrorKind {
  if (!(err instanceof ApiError)) return "other";
  const code = codeOf(err);
  switch (err.status) {
    case 503:
      if (code === "PAYMENT_NOT_ACTIVE") return "not_active";
      if (code === "PAYMENT_RETURN_URL_NOT_CONFIGURED") return "return_url";
      return "other";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 422:
      if (code === "SURCHARGE_CAP_EXCEEDED") return "cap_exceeded";
      if (code === "PAYMENT_UNSUPPORTED_CURRENCY") return "currency";
      return "invalid";
    case 409:
      switch (code) {
        case "SURCHARGE_NOTICE_NOT_ELAPSED":
          return "notice_not_elapsed";
        case "SURCHARGE_DISPUTE_WINDOW_CLOSED":
          return "dispute_closed";
        case "SURCHARGE_PAYMENT_IN_FLIGHT":
          return "in_flight";
        case "PAYMENT_INVALID_STATE":
          return "invalid_state";
        case "AUTHORIZATION_ALREADY_ACTIVE":
          return "authorization_exists";
        case "CONSENT_TEXT_NOT_CURRENT":
          return "consent_stale";
        case "PAYMENT_METHOD_NOT_AVAILABLE":
          return "method_unavailable";
        default:
          return "conflict";
      }
    default:
      return "other";
  }
}

/** Resultado del cobro (`charge`/`reject_dispute`) a clave i18n (sufijo de `payments.surcharges.result.*`). Desconocido -> `unknown`. */
export function chargeResultKey(result: string | undefined): string {
  switch (result) {
    case "charged":
    case "pending":
    case "failed":
    case "requires_invoice":
    case "waiting":
      return result;
    default:
      return "unknown";
  }
}

/** Número de páginas del paginador; mínimo 1. */
export function pageCount(total: number, perPage: number): number {
  if (!Number.isFinite(total) || total <= 0 || perPage <= 0) return 1;
  return Math.ceil(total / perPage);
}

/** ¿El recargo se cobró por TMWE como respaldo y falta transferir al partner? (`settlement_required`, 0/1 o booleano). */
export function needsSettlement(row: Pick<PaySurcharge, "settlement_required" | "settled_at">): boolean {
  const flag = row.settlement_required;
  return (flag === true || flag === 1 || (flag as unknown) === "1") && !row.settled_at;
}
