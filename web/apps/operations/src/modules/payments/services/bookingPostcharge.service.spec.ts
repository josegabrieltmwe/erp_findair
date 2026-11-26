import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Servicio de «Cobrar postfacturación» (`bookingPostcharges`, P148): ruta, query y cuerpo del contrato
 * (`api_booking_postcharge`, docs/contrato-con-api.md), `null` cuando el envío no tiene postfacturación y `replayed` en el
 * POST idempotente. Patrón: paySurcharges.service.spec.ts.
 */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: null };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import { bookingPostcharges } from "@shared/payment_gateways/services/paymentGateways.service";

const ROW = {
  postcharge_id: "a1b2",
  kind: "express",
  shipment_id: 1001,
  customer_id: 77,
  status: "notified",
  method: "authorization",
  description: "Riaddebito peso",
  net: "19.50",
  vat: "4.29",
  total: "23.79",
  currency: "EUR",
  surcharge_id: "psu_x",
  invoice_id: null,
  crm_id: null,
  error: "",
  created_at: "2026-11-26 10:00:00",
  updated_at: null,
};

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: null };
});

describe("bookingPostcharges", () => {
  // Escenario: envío sin postfacturación; el GET lleva kind y shipment_id y devuelve null.
  it("GET con kind y shipment_id; sin postfacturación devuelve null", async () => {
    const res = await bookingPostcharges.get("cargo", 55);
    expect(calls[0]).toMatchObject({
      url: "/api_booking_postcharge",
      opts: { query: { kind: "cargo", shipment_id: 55 } },
    });
    expect(calls[0].opts.method).toBeUndefined();
    expect(res).toBeNull();
  });

  it("GET devuelve la postfacturación tal cual", async () => {
    reply = { success: true, data: ROW };
    const res = await bookingPostcharges.get("express", 1001);
    expect(res?.total).toBe("23.79");
    expect(res?.status).toBe("notified");
  });

  // Escenario: POST nuevo y POST repetido (ya había una viva): `replayed` distingue los dos.
  it("POST manda {kind, shipment_id} y expone replayed", async () => {
    reply = { success: true, data: { ...ROW, replayed: false } };
    const first = await bookingPostcharges.start("express", 1001);
    expect(calls[0]).toMatchObject({
      url: "/api_booking_postcharge",
      opts: { method: "POST", body: { kind: "express", shipment_id: 1001 } },
    });
    expect(first.replayed).toBe(false);

    reply = { success: true, data: { ...ROW, replayed: true } };
    expect((await bookingPostcharges.start("express", 1001)).replayed).toBe(
      true,
    );
  });

  it("success:false es un error", async () => {
    reply = { success: false, error: { message: "x", code: "NOT_INVOICED" } };
    await expect(bookingPostcharges.start("express", 1)).rejects.toThrow();
  });
});
