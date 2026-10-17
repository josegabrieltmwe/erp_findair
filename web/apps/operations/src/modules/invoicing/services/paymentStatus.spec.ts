import { describe, expect, it } from "vitest";
import {
  sanitizePaymentFilter,
  showPendingDetail,
  visiblePaymentStatus,
} from "./paymentStatus";
import { buildInvoiceListQuery } from "./invoice.service";
import { supplierFilters } from "../stores/invoice_list.store";
import { buildSupplierListQuery } from "./supplierInvoice.service";

describe("estado de pago", () => {
  it("'none' y desconocidos no se muestran", () => {
    expect(visiblePaymentStatus({ status: "none" })).toBeNull();
    expect(visiblePaymentStatus(null)).toBeNull();
    expect(visiblePaymentStatus({ status: "overdue" })).toBe("overdue");
  });
  it("sanea el filtro", () => {
    expect(sanitizePaymentFilter("paid")).toBe("paid");
    expect(sanitizePaymentFilter("none")).toBeUndefined();
    expect(sanitizePaymentFilter("")).toBeUndefined();
  });
  it("detalle solo con cuotas abiertas", () => {
    expect(showPendingDetail({ status: "paid" })).toBe(false);
    expect(showPendingDetail({ status: "pending" })).toBe(true);
  });
});

describe("filtro stato_pagamento en las peticiones", () => {
  it("emitidas", () => {
    const qs = buildInvoiceListQuery({
      stato_pagamento: "overdue",
      numero: "",
      page: 1,
    });
    expect(qs.get("stato_pagamento")).toBe("overdue");
    expect(qs.has("numero")).toBe(false);
  });
  it("recibidas", () => {
    expect(
      buildSupplierListQuery({ stato_pagamento: "paid", search: "x" }),
    ).toEqual({ stato_pagamento: "paid", search: "x" });
  });
});

describe("supplierFilters", () => {
  it("quita lo que no aplica a recibidas", () => {
    expect(
      supplierFilters({ tipo_fattura: "P", numero: "1", sort: "x" }),
    ).toEqual({ numero: "1" });
  });
});
