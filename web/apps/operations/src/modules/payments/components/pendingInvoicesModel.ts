/**
 * Lógica pura de la pantalla «Facturas pendientes de cobro» (`PendingInvoicesPage.vue`): permisos de UX, estado de
 * cada fila, acción disponible, importes y paginación. Sin Vue ni red para probarla aislada
 * (ver pendingInvoicesModel.spec.ts). El listado viene de `payPendingInvoices.list`; el cobro de cada fila lo hace
 * `PayOnlineDialog` (se reutiliza tal cual, con la factura de la fila).
 */
import { hasScope, type AccessSnapshot } from "@shared/composables/useAccess";
import type { PendingInvoice } from "@shared/payment_gateways/services/paymentGateways.service";
import { canPayOnline } from "./payOnlineModel";

/**
 * Scopes para VER la lista: ambos a la vez, igual que el API (`invoices:read` decide qué facturas se ven y
 * `payment_gateways:read` da el dato del cobro en curso). Es solo UX: el API autoriza cada petición y responde 403.
 */
export const PENDING_INVOICES_SCOPES = ["invoices:read", "payment_gateways:read"] as const;

/** ¿Puede la persona abrir la lista? Exige todos los scopes de `PENDING_INVOICES_SCOPES`. */
export function canListPendingInvoices(access: AccessSnapshot): boolean {
  return hasScope(access, PENDING_INVOICES_SCOPES, "all");
}

/** Filas por página de la pantalla (el API admite hasta 100). */
export const PENDING_PER_PAGE = 25;

/** Estado visual de una fila, en orden de gravedad: vencida, con pago en curso, o al día. */
export type PendingRowStatus = "overdue" | "in_progress" | "pending";

/**
 * Estado que se pinta en la columna «Estado». La mora manda sobre el pago en curso porque es lo que la persona debe
 * atender; el pago en curso se avisa además con su propio icono/aviso en la fila (ver `hasPaymentInProgress`).
 */
export function pendingRowStatus(row: Pick<PendingInvoice, "overdue" | "in_progress">): PendingRowStatus {
  if (row.overdue) return "overdue";
  if (row.in_progress) return "in_progress";
  return "pending";
}

/** ¿Hay un pago en vuelo (aunque se pueda pagar el resto)? Contrato: avisar «hay un pago en curso». */
export function hasPaymentInProgress(row: Pick<PendingInvoice, "in_progress">): boolean {
  return row.in_progress === true;
}

/** Acción de la fila: `pay` = botón «Cobrar online» activo; `blocked` = deshabilitado con motivo; `none` = sin botón. */
export type PendingRowAction = "pay" | "blocked" | "none";

/**
 * Decide la acción de una fila. El botón solo se ofrece a quien puede cobrar (`payment_gateways:write`, vía
 * `canPayOnline`); ver la lista con solo lectura no da botón. Con permiso, solo `payable = true` lo activa: si la API
 * dice que no es cobrable (divisa no soportada o pago en curso que cubre todo lo pendiente) se muestra bloqueado y el
 * motivo, nunca un botón que acabaría en 409.
 */
export function rowAction(row: Pick<PendingInvoice, "payable">, access: AccessSnapshot): PendingRowAction {
  if (!canPayOnline(access)) return "none";
  return row.payable ? "pay" : "blocked";
}

/**
 * Clave i18n (sin el prefijo `payments.pending.`) del motivo de no cobrable. Motivo desconocido -> `unknown`, para que
 * una razón nueva de la API no deje la celda vacía ni rompa la pantalla.
 */
export function notPayableReasonKey(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason === "CURRENCY_NOT_SUPPORTED") return "reason.currency";
  if (reason === "PAYMENT_IN_PROGRESS") return "reason.in_progress";
  return "reason.unknown";
}

/**
 * Importe de texto decimal de la API ("122.00") a número SOLO para mostrar y para el diálogo (`pending`, en unidades).
 * Texto no numérico -> 0 (el diálogo deshabilita el cobro con pendiente 0). El cálculo del cobro lo hace el API.
 */
export function amountToNumber(text: string | number | null | undefined): number {
  const n = Number(text ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Número de páginas para el paginador; mínimo 1 para que el control no quede en 0. */
export function pageCount(total: number, perPage: number): number {
  if (!Number.isFinite(total) || total <= 0 || perPage <= 0) return 1;
  return Math.ceil(total / perPage);
}
