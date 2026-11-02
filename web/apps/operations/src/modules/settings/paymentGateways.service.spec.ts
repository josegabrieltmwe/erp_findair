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
