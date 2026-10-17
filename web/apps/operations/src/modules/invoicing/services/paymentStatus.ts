import type { PaymentSummary, PaymentSummaryStatus } from "./invoice.service";

export const PAYMENT_FILTER_VALUES: Exclude<PaymentSummaryStatus, "none">[] = [
  "paid",
  "pending",
  "overdue",
];

export const PAYMENT_COLOR: Record<PaymentSummaryStatus, string> = {
  paid: "success",
  pending: "info",
  overdue: "error",
  none: "grey",
};

/** El estado 'none' no se muestra; cualquier valor desconocido tampoco. */
export function visiblePaymentStatus(
  p: PaymentSummary | null | undefined,
): Exclude<PaymentSummaryStatus, "none"> | null {
  const s = p?.status;
  return s === "paid" || s === "pending" || s === "overdue" ? s : null;
}

/** Valor válido para `stato_pagamento` o undefined (evita el 400 del servidor). */
export function sanitizePaymentFilter(v: unknown): string | undefined {
  return PAYMENT_FILTER_VALUES.includes(v as never) ? (v as string) : undefined;
}

/** El saldo y el próximo vencimiento solo tienen sentido con cuotas abiertas. */
export function showPendingDetail(
  p: PaymentSummary | null | undefined,
): boolean {
  const s = visiblePaymentStatus(p);
  return s === "pending" || s === "overdue";
}
