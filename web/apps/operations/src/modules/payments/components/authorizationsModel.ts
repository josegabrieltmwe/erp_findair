/**
 * Lógica pura de las pantallas de AUTORIZACIONES DE COBRO (`AuthorizationsPage.vue`, `AuthorizationCreateDialog.vue`):
 * qué acciones ofrece cada fila, formato del medio de pago guardado y reglas del alta (clave de idempotencia, sondeo
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
 * Medio de pago guardado para mostrar, sin datos sensibles: «VISA ····4242 (12/2028)» o «SEPA ····1234». Solo marca,
 * últimos 4 y caducidad, que son los únicos campos que publica el API. Sin últimos 4 (aún `pending`): «—».
 */
export function describeMethod(
  row: Pick<PayAuthorization, "method_type" | "brand" | "last4" | "exp_month" | "exp_year">,
  cardLabel = "Card",
): string {
  if (!row.last4) return "—";
  // `cardLabel` lo pone la pantalla ya traducido (`payments.authorizations.method.card`): antes el texto «Tarjeta» estaba
  // fijo aquí y salía en español también con la interfaz en inglés o italiano (hallado en el navegador).
  const label = row.method_type === "sepa_debit" ? "SEPA" : (row.brand || "").toUpperCase() || cardLabel;
  const exp =
    row.exp_month && row.exp_year ? ` (${String(row.exp_month).padStart(2, "0")}/${row.exp_year})` : "";
  return `${label} ····${row.last4}${exp}`;
}
