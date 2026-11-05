import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Servicio de autorizaciones de cobro y recargos (`payAuthorizations`, `paySurcharges`): comprueba que cada método
 * llama a la ruta y al cuerpo del contrato (docs/contrato-con-api.md), que NUNCA envía `partner_id` (el partner sale del
 * token) y que los importes viajan como ENTEROS en céntimos. Patrón: settings/paymentGateways.service.spec.ts.
 */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: [] };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import { payAuthorizations, paySurcharges } from "@shared/payment_gateways/services/paymentGateways.service";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: [] };
});

describe("payAuthorizations", () => {
  // Escenario: texto de consentimiento con locale por defecto es-ES.
  it("pide el texto de consentimiento con view y locale", async () => {
    reply = { success: true, data: { version: "v1", locale: "es-ES", body_hash: "h", body: "texto", terms: { max_charge_minor: 15000, max_month_minor: 50000, notice_days: 3, dispute_days: 14, currency: "EUR" } } };
    const t = await payAuthorizations.consentText();
    expect(calls[0]).toMatchObject({ url: "/api_pay_authorizations", opts: { query: { view: "consent_text", locale: "es-ES" } } });
    expect(t.terms.max_charge_minor).toBe(15000);
  });

  // Escenario: listado paginado con filtros; devuelve la paginación del API.
  it("lista con filtros y devuelve la paginación", async () => {
    reply = { success: true, data: [{ public_id: "pau_a" }], total: 41, page: 2, per_page: 10 };
    const res = await payAuthorizations.list({ status: "active", customerId: 7, page: 2, perPage: 10 });
    expect(calls[0].opts.query).toEqual({ page: 2, per_page: 10, status: "active", customer_id: 7 });
    expect(res).toMatchObject({ total: 41, page: 2, perPage: 10 });
    expect(res.rows).toHaveLength(1);
  });

  // Escenario: el alta fija return_to=erp y accepted=true; la prueba del consentimiento no viaja (la pone el servidor).
  it("el alta envía consent, return_to=erp e idempotency_key y nunca IP ni user agent", async () => {
    reply = { success: true, replayed: false, data: { public_id: "pau_x", status: "pending", checkout_url: "https://checkout.stripe.com/c/x" } };
    const res = await payAuthorizations.create({
      customer_id: 4521,
      method: "sepa_debit",
      consentTextVersion: "v1",
      consentLocale: "es-ES",
      idempotency_key: "erp-auth-1234",
    });
    expect(calls[0]).toMatchObject({
      url: "/api_pay_authorizations",
      opts: {
        method: "POST",
        body: {
          customer_id: 4521,
          method: "sepa_debit",
          consent: { text_version: "v1", locale: "es-ES", accepted: true },
          return_to: "erp",
          idempotency_key: "erp-auth-1234",
        },
      },
    });
    expect(JSON.stringify(calls[0].opts)).not.toMatch(/partner_id|"ip"|user_agent/);
    expect(res.replayed).toBe(false);
    expect(res.authorization.checkout_url).toContain("https://");
  });

  // Escenario: un reintento (200 replayed) no trae checkout_url.
  it("marca replayed cuando el API repite la respuesta", async () => {
    reply = { success: true, replayed: true, data: { public_id: "pau_x", status: "pending", checkout_url: null } };
    const res = await payAuthorizations.create({ customer_id: 1, method: "card", consentTextVersion: "v1", consentLocale: "es-ES", idempotency_key: "erp-auth-1234" });
    expect(res.replayed).toBe(true);
    expect(res.authorization.checkout_url).toBeNull();
  });

  it("revocar y leer usan id y action", async () => {
    reply = { success: true, data: { public_id: "pau_x", status: "revoked" } };
    await payAuthorizations.revoke("pau_x");
    await payAuthorizations.get("pau_x");
    expect(calls[0].opts).toMatchObject({ method: "POST", body: { action: "revoke", id: "pau_x" } });
    expect(calls[1].opts.query).toEqual({ id: "pau_x" });
  });

  it("un success:false se convierte en error con el texto del API", async () => {
    reply = { success: false, error: { code: "PAYMENT_NOT_ACTIVE", message: "apagado" } };
    await expect(payAuthorizations.revoke("pau_x")).rejects.toThrow("apagado");
  });
});

describe("paySurcharges", () => {
  // Escenario: el listado nunca ofrece vista cruzada: ningún partner_id viaja.
  it("lista con filtros y sin partner_id", async () => {
    reply = { success: true, data: [{ public_id: "psu_a" }], total: 1, page: 1, per_page: 25 };
    await paySurcharges.list({ status: "disputed", customerId: 9 });
    expect(calls[0].url).toBe("/api_pay_surcharges");
    expect(calls[0].opts.query).toEqual({ page: 1, per_page: 25, status: "disputed", customer_id: 9 });
    expect(JSON.stringify(calls[0].opts)).not.toMatch(/partner_id/);
  });

  it("pendientes de transferir usan view=pending_transfer", async () => {
    reply = { success: true, data: [{ public_id: "psu_a" }, { public_id: "psu_b" }], total: 2 };
    const rows = await paySurcharges.pendingTransfer();
    expect(calls[0].opts.query).toEqual({ view: "pending_transfer" });
    expect(rows).toHaveLength(2);
  });

  // Escenario: el importe viaja como entero en céntimos dentro de amount, con divisa EUR; lo opcional vacío no se envía.
  it("proponer envía amount_minor entero y omite lo opcional vacío", async () => {
    reply = { success: true, replayed: false, data: { public_id: "psu_x", status: "pending_notice" } };
    await paySurcharges.propose({
      customer_id: 4521,
      surcharge_type: "overweight",
      amount_minor: 4200,
      declared_value: "10",
      measured_value: "14",
      evidence: "acta",
    });
    const body = calls[0].opts.body as Record<string, unknown>;
    expect(body.amount).toEqual({ amount_minor: 4200, currency: "EUR" });
    expect(Number.isInteger((body.amount as { amount_minor: number }).amount_minor)).toBe(true);
    expect(body).not.toHaveProperty("carrier_ref");
    expect(body).not.toHaveProperty("authorization");
    expect(body).not.toHaveProperty("partner_id");
  });

  it("proponer devuelve replayed cuando el hecho ya existía", async () => {
    reply = { success: true, replayed: true, data: { public_id: "psu_x" } };
    const res = await paySurcharges.propose({ customer_id: 1, surcharge_type: "other", amount_minor: 100, evidence: "x" });
    expect(res.replayed).toBe(true);
  });

  // Escenario: cada acción es un POST con action e id; solo dispute y waive llevan reason.
  it("las acciones usan action e id y solo dispute/waive llevan motivo", async () => {
    reply = { success: true, data: { public_id: "psu_x" } };
    await paySurcharges.notify("psu_x");
    await paySurcharges.dispute("psu_x", "no coincide");
    await paySurcharges.waive("psu_x", "cortesía");
    await paySurcharges.rejectDispute("psu_x");
    await paySurcharges.charge("psu_x");
    expect(calls.map((c) => c.opts.body)).toEqual([
      { action: "notify", id: "psu_x" },
      { action: "dispute", id: "psu_x", reason: "no coincide" },
      { action: "waive", id: "psu_x", reason: "cortesía" },
      { action: "reject_dispute", id: "psu_x" },
      { action: "charge", id: "psu_x" },
    ]);
    for (const c of calls) expect(c.opts.method).toBe("POST");
  });

  it("devuelve result y refund_requested de la respuesta", async () => {
    reply = { success: true, result: "requires_invoice", data: { public_id: "psu_x" } };
    expect((await paySurcharges.charge("psu_x")).result).toBe("requires_invoice");
    reply = { success: true, refund_requested: true, data: { public_id: "psu_x" } };
    expect((await paySurcharges.waive("psu_x", "r")).refundRequested).toBe(true);
    reply = { success: true, data: { public_id: "psu_x" } };
    expect((await paySurcharges.notify("psu_x")).refundRequested).toBeUndefined();
  });
});
