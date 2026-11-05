import { describe, expect, it } from "vitest";
import { buildAccess } from "@shared/composables/useAccess";
import {
  amountToNumber,
  canListPendingInvoices,
  notPayableReasonKey,
  pageCount,
  pendingRowStatus,
  rowAction,
} from "./pendingInvoicesModel";

const acc = (scopes: string[]) => buildAccess({ access: { scopes } });

describe("canListPendingInvoices", () => {
  // Escenario: la lista exige invoices:read Y payment_gateways:read; con uno solo el API respondería 403.
  it("exige ambos scopes de lectura", () => {
    expect(canListPendingInvoices(acc(["invoices:read", "payment_gateways:read"]))).toBe(true);
    expect(canListPendingInvoices(acc(["invoices:read"]))).toBe(false);
    expect(canListPendingInvoices(acc(["payment_gateways:read"]))).toBe(false);
    expect(canListPendingInvoices(acc(["payments:read"]))).toBe(false);
    expect(canListPendingInvoices(buildAccess(null))).toBe(false);
  });
});

describe("pendingRowStatus", () => {
  // Escenario: vencida manda sobre pago en curso; en curso manda sobre normal.
  it("prioriza vencida, luego pago en curso, luego pendiente", () => {
    expect(pendingRowStatus({ overdue: true, in_progress: true })).toBe("overdue");
    expect(pendingRowStatus({ overdue: false, in_progress: true })).toBe("in_progress");
    expect(pendingRowStatus({ overdue: false, in_progress: false })).toBe("pending");
  });
});

describe("rowAction", () => {
  const write = acc(["invoices:read", "payment_gateways:read", "payment_gateways:write"]);
  const readOnly = acc(["invoices:read", "payment_gateways:read"]);
  // Escenario: con write y payable=true hay botón activo; con payable=false se bloquea (el POST daría 409);
  // sin write no hay botón aunque la factura sea cobrable.
  it("solo ofrece cobrar con payment_gateways:write y factura cobrable", () => {
    expect(rowAction({ payable: true }, write)).toBe("pay");
    expect(rowAction({ payable: false }, write)).toBe("blocked");
    expect(rowAction({ payable: true }, readOnly)).toBe("none");
    expect(rowAction({ payable: false }, readOnly)).toBe("none");
  });
});

describe("notPayableReasonKey", () => {
  // Escenario: motivos del contrato, ausencia (cobrable) y un motivo futuro desconocido.
  it("mapea los motivos conocidos y tolera los nuevos", () => {
    expect(notPayableReasonKey(null)).toBeNull();
    expect(notPayableReasonKey("CURRENCY_NOT_SUPPORTED")).toBe("reason.currency");
    expect(notPayableReasonKey("PAYMENT_IN_PROGRESS")).toBe("reason.in_progress");
    expect(notPayableReasonKey("ALGO_NUEVO")).toBe("reason.unknown");
  });
});

describe("amountToNumber", () => {
  // Escenario: textos decimales de la API a número para mostrar; basura -> 0.
  it("convierte texto decimal y neutraliza valores no numéricos", () => {
    expect(amountToNumber("122.00")).toBe(122);
    expect(amountToNumber("0.30")).toBe(0.3);
    expect(amountToNumber("abc")).toBe(0);
    expect(amountToNumber(null)).toBe(0);
  });
});

describe("pageCount", () => {
  // Escenario: 51 filas a 25 por página son 3 páginas; vacío o datos raros dan 1.
  it("redondea hacia arriba y nunca baja de 1", () => {
    expect(pageCount(51, 25)).toBe(3);
    expect(pageCount(50, 25)).toBe(2);
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(Number.NaN, 25)).toBe(1);
    expect(pageCount(10, 0)).toBe(1);
  });
});
