/**
 * Lógica pura de las pantallas de AUTORIZACIONES DE COBRO (`AuthorizationsPage.vue`, `AuthorizationCreateDialog.vue`):
 * qué acciones ofrece cada fila, tipo de medio de pago y reglas del alta (clave de idempotencia, sondeo
 * hasta `active`). Sin Vue ni red, para probarla aislada (ver authorizationsModel.spec.ts).
 *
 * Qué es una autorización: el permiso que el cliente firma UNA vez para que el vendedor le cobre después recargos con el
 * método guardado (tarjeta o adeudo SEPA) sin que el cliente esté presente. El alta usa Stripe Checkout `setup` ALOJADO:
 * la tarjeta o el IBAN los teclea el cliente en la página de la pasarela y jamás tocan el ERP ni TMWE. El estado pasa a
 * `active` SOLO por el webhook de la pasarela, nunca por el retorno del navegador: por eso la pantalla sondea el GET.
 *
 * Los errores y los permisos (`payment_gateways:read|write`) comparten reglas con `surchargesModel.ts`.
 */
import type { AccessSnapshot } from "@shared/composables/useAccess";
import type {
  PayAuthorization,
  PayAuthorizationStatus,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { canWriteSurcharges } from "./surchargesModel";

/** Estados en los que la autorización ya no cambiará sola: se deja de sondear. `pending` es el único transitorio. */
const SETTLED: ReadonlySet<PayAuthorizationStatus | string> = new Set(["active", "failed", "revoked", "expired"]);

/** ¿El estado es definitivo para el sondeo del alta? */
export function isAuthorizationSettled(status: PayAuthorizationStatus | string | null | undefined): boolean {
  return !!status && SETTLED.has(status);
}

/**
 * Genera la clave de idempotencia de UN intento de alta (8-64 caracteres `A-Za-z0-9_-:`). Se crea al abrir el diálogo y
 * se reutiliza en los reintentos de la misma petición: un doble clic no abre dos Checkout. El API acota la clave por
 * cliente, así que dos clientes del mismo vendedor pueden coincidir sin chocar.
 */
export function newAuthorizationKey(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `erp-auth-${uuid}`.slice(0, 64);
}

/** Acciones de una fila de autorizaciones. */
export type AuthorizationAction = "revoke";

/**
 * Acciones disponibles: revocar una autorización `pending` o `active` si la persona tiene `payment_gateways:write`.
 * (El API responde 409 si ya caducó o falló.) Revocar funciona aunque el interruptor del servidor esté apagado.
 */
export function availableAuthorizationActions(row: Pick<PayAuthorization, "status">, access: AccessSnapshot): AuthorizationAction[] {
  if (!canWriteSurcharges(access)) return [];
  return row.status === "active" || row.status === "pending" ? ["revoke"] : [];
}

/** Color del chip de estado. */
export function authorizationStatusColor(status: PayAuthorizationStatus | string): string {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "info";
    case "failed":
      return "error";
    case "revoked":
    case "expired":
      return "grey";
    default:
      return "default";
  }
}

/**
 * Clave i18n del tipo de medio de pago (`payments.authorizations.method.card` / `.sepa_debit`). Es lo único que se
 * muestra del medio: desde el 2026-11-26 el API no guarda ni devuelve marca, últimos 4 ni caducidad (solo la
 * autorización; el método queda en el proveedor). Un tipo desconocido cae en tarjeta, el método por defecto (D5).
 */
export function methodLabelKey(method: PayAuthorization["method_type"] | string | null | undefined): string {
  return method === "sepa_debit"
    ? "payments.authorizations.method.sepa_debit"
    : "payments.authorizations.method.card";
}

/** Icono del tipo de medio de pago. */
export function methodIcon(method: PayAuthorization["method_type"] | string | null | undefined): string {
  return method === "sepa_debit" ? "mdi-bank-outline" : "mdi-credit-card-outline";
}
