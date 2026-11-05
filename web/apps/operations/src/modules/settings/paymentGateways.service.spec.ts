import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: [] };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import {
  enabledMethods,
  payFieldErrors,
  payGatewayAccounts,
  payGatewayAccountsAdmin,
  payPayments,
  payPendingInvoices,
  classifyPendingInvoicesError,
  payRefunds,
  truthy,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { ApiError } from "@shared/anagrafiche/services/api.types";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: [] };
});

describe("payGatewayAccounts", () => {
  it("nunca envía partner_id: el partner sale del token", async () => {
    await payGatewayAccounts.list("sandbox");
    await payGatewayAccounts.create({
      provider: "stripe",
      environment: "sandbox",
      account_alias: "Mi cuenta",
      secret: "sk_test_x",
    });
    await payGatewayAccounts.update({ id: "pga_aaaaaaaaaaaaaaaaaaaaaaaa", account_alias: "Otra" });
    for (const c of calls) {
      expect(c.url).toBe("/api_pay_gateway_accounts");
      expect(JSON.stringify(c.opts)).not.toMatch(/partner_id|anagrafica_id/);
    }
    expect(calls[0].opts.query).toEqual({ environment: "sandbox" });
  });

  it("rotar solo envía lo que se rellena y validar/principal usan action", async () => {
    await payGatewayAccounts.rotateSecret("pga_x", { secret: "", webhook_secret: "whsec_1" });
    expect(calls[0].opts).toMatchObject({ method: "POST", body: { action: "rotate_secret", id: "pga_x", webhook_secret: "whsec_1" } });
    expect(calls[0].opts.body).not.toHaveProperty("secret");
    await payGatewayAccounts.validate("pga_x");
    expect(calls[1].opts).toMatchObject({ method: "POST", body: { action: "validate", id: "pga_x" } });
    await payGatewayAccounts.setPrincipal("pga_x");
    expect(calls[2].opts).toMatchObject({ method: "PUT", body: { action: "set_principal", id: "pga_x" } });
    await payGatewayAccounts.remove("pga_x");
    expect(calls[3].opts).toMatchObject({ method: "DELETE", body: { id: "pga_x" } });
  });

  it("propaga el mensaje de error de la API, sea cadena u objeto", async () => {
    reply = { success: false, error: { code: "PAY_GATEWAY_ACCOUNT_INVALID", message: "Secreto no válido" } };
    await expect(payGatewayAccounts.validate("pga_x")).rejects.toThrow("Secreto no válido");
    reply = { success: false, error: "Sin permisos" };
    await expect(payGatewayAccounts.list()).rejects.toThrow("Sin permisos");
  });
});

describe("payGatewayAccountsAdmin", () => {
  it("es de solo lectura y filtra por partner", async () => {
    await payGatewayAccountsAdmin.list({ partnerId: 7, environment: "production" });
    expect(calls[0].url).toBe("/api_admin_pay_gateway_accounts");
    expect(calls[0].opts.query).toEqual({ partner_id: 7, environment: "production" });
    expect(calls[0].opts.method).toBeUndefined();
    expect(Object.keys(payGatewayAccountsAdmin)).toEqual(["list"]);
  });
});

describe("payRefunds", () => {
  it("la aprobación solo envía el id: quien aprueba lo decide el servidor", async () => {
    reply = { success: true, data: { id: "prf_x", status: "succeeded" } };
    await payRefunds.approve("prf_x");
    expect(calls[0]).toMatchObject({ url: "/api_pay_refunds", opts: { method: "POST", body: { action: "approve", id: "prf_x" } } });
    await payRefunds.reject("prf_x");
    expect(calls[1].opts.body).toEqual({ action: "reject", id: "prf_x" });
    for (const c of calls) expect(JSON.stringify(c.opts)).not.toMatch(/approved_by|requested_by/);
  });

  it("distingue el reembolso hecho (201) del que espera aprobación (202)", async () => {
    reply = { success: true, awaiting_approval: true, replayed: false, data: { id: "prf_x", status: "awaiting_approval" } };
    const r = await payRefunds.request({
      payment_id: "pay_x",
      amount: "150.00",
      reason: "duplicate",
      idempotency_key: "key-0001-abcd",
    });
    expect(r.awaiting_approval).toBe(true);
    expect(r.refund.status).toBe("awaiting_approval");
    expect(JSON.stringify(calls[0].opts)).not.toMatch(/approved_by/);
  });

  it("lista las vistas por parámetro", async () => {
    await payRefunds.listAwaitingApproval();
    await payRefunds.installmentsReview();
    expect(calls.map((c) => c.opts.query)).toEqual([{ view: "awaiting_approval" }, { view: "installments_review" }]);
  });
});

describe("payPayments", () => {
  // Escenario: el alta fija método, retorno y flujo alojado; sin importe no se envía amount; nunca partner_id.
  it("crea el cobro en modo alojado con la clave de idempotencia", async () => {
    reply = { success: true, data: { id: "pay_1", status: "pending", checkout_url: "https://checkout.stripe.com/x", expires_at: "2026-11-05T12:00:00Z" } };
    const res = await payPayments.create({ invoice_id: 7, idempotency_key: "k1" });
    expect(calls[0].url).toBe("/api_pay_payments");
    expect(calls[0].opts).toMatchObject({
      method: "POST",
      body: { invoice_id: 7, method: "card", idempotency_key: "k1", return_to: "erp", flow: "hosted" },
    });
    expect(calls[0].opts.body).not.toHaveProperty("amount");
    expect(JSON.stringify(calls[0].opts)).not.toMatch(/partner_id|client_secret/);
    expect(res).toMatchObject({ replayed: false, alreadyPaid: false });
    expect(res.payment.checkout_url).toContain("https://");
  });

  // Escenario: cobro parcial con divisa y repetición de la misma clave (replayed).
  it("envía amount/currency si se indican y respeta replayed", async () => {
    reply = { success: true, replayed: true, data: { id: "pay_1", status: "pending", checkout_url: "https://c.test/x" } };
    const res = await payPayments.create({ invoice_id: 7, amount: "40.50", currency: "EUR", idempotency_key: "k1" });
    expect(calls[0].opts.body).toMatchObject({ amount: "40.50", currency: "EUR" });
    expect(res.replayed).toBe(true);
  });

  // Escenario: factura ya cobrada (201) llega sin checkout_url y con estado succeeded.
  it("marca alreadyPaid cuando no hay página de pago y el cobro ya está hecho", async () => {
    reply = { success: true, data: { id: "pay_2", status: "succeeded" } };
    expect((await payPayments.create({ invoice_id: 7, idempotency_key: "k2" })).alreadyPaid).toBe(true);
  });

  // Escenario: detalle por id y listado por factura/estado usan solo parámetros de la lista blanca del BFF.
  it("consulta el detalle por id y lista por factura y estado", async () => {
    reply = { success: true, data: { id: "pay_1", status: "processing" } };
    expect((await payPayments.get("pay_1")).status).toBe("processing");
    expect(calls[0].opts).toEqual({ query: { id: "pay_1" } });
    reply = { success: true, data: [] };
    await payPayments.list({ invoiceId: 7, status: "succeeded" });
    expect(calls[1].opts).toEqual({ query: { invoice_id: 7, status: "succeeded" } });
  });

  // Escenario: una respuesta success:false se convierte en Error con el mensaje de la API.
  it("propaga el mensaje cuando success es false", async () => {
    reply = { success: false, error: { code: "X", message: "Rechazado" } };
    await expect(payPayments.create({ invoice_id: 7, idempotency_key: "k" })).rejects.toThrow("Rechazado");
  });
});

describe("utilidades", () => {
  it("interpreta métodos y booleanos de MySQL", () => {
    expect(enabledMethods({ enabled_methods: "card, sepa_debit," })).toEqual(["card", "sepa_debit"]);
    expect(enabledMethods({ enabled_methods: "" })).toEqual([]);
    expect([true, 1, "1"].every(truthy)).toBe(true);
    expect([false, 0, "0", null, undefined].some(truthy)).toBe(false);
  });

  it("extrae errores por campo", () => {
    expect(payFieldErrors(new Error("x"))).toEqual({});
    const err = new ApiError("x", 422, undefined, { error: { details: { fields: { secret: ["Obligatorio"], account_alias: "Repetido" } } } });
    expect(payFieldErrors(err)).toEqual({ secret: "Obligatorio", account_alias: "Repetido" });
  });
});

describe("payPendingInvoices", () => {
  // Escenario: la lista llama a la ruta de solo lectura con page/per_page y sin ningún filtro por cliente/partner
  // (salen del token); devuelve filas y paginación, con los importes como texto.
  it("pide la página sin filtros de identidad y devuelve filas y paginación", async () => {
    reply = {
      success: true,
      data: [{ invoice_id: 5, number: 187, pending: "122.00", payable: true }],
      total: 51,
      page: 2,
      per_page: 25,
    };
    const res = await payPendingInvoices.list(2, 25);
    expect(calls[0].url).toBe("/api_pay_pending_invoices");
    expect(calls[0].opts.query).toEqual({ page: 2, per_page: 25 });
    expect(calls[0].opts.method).toBeUndefined();
    expect(JSON.stringify(calls[0].opts)).not.toMatch(/partner_id|customer_id|id_cliente/);
    expect(res).toMatchObject({ total: 51, page: 2, perPage: 25 });
    expect(res.rows[0].pending).toBe("122.00");
  });

  // Escenario: respuesta sin total/page (backend antiguo): se rellena con lo pedido y la longitud de la página.
  it("completa la paginación cuando la API no la trae", async () => {
    reply = { success: true, data: [{ invoice_id: 1 }, { invoice_id: 2 }] };
    expect(await payPendingInvoices.list()).toMatchObject({ total: 2, page: 1, perPage: 25 });
  });

  // Escenario: success=false del envelope se convierte en Error (no en lista vacía).
  it("un success=false lanza error y no devuelve lista vacía", async () => {
    reply = { success: false, error: { message: "boom" } };
    await expect(payPendingInvoices.list()).rejects.toThrow("boom");
  });
});

describe("classifyPendingInvoicesError", () => {
  // Escenario: 403 sin permiso, 503 lectura no disponible, y cualquier otro error (red, 500, no-ApiError).
  it("distingue 403, 503 y el resto", () => {
    expect(classifyPendingInvoicesError(new ApiError("x", 403, "FORBIDDEN"))).toBe("forbidden");
    expect(classifyPendingInvoicesError(new ApiError("x", 503, "PAYMENT_PENDING_UNAVAILABLE"))).toBe("unavailable");
    expect(classifyPendingInvoicesError(new ApiError("x", 500))).toBe("other");
    expect(classifyPendingInvoicesError(new Error("red"))).toBe("other");
  });
});
