import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { ApiError } from "@shared/anagrafiche/services/api.types";

/**
 * «Cobrar postfacturación» (P148), test de MONTAJE real: el panel pinta la postfacturación que devuelve el GET, ofrece el
 * botón solo con `payment_gateways:write` y deshabilitado si el envío no está listo, pide confirmación antes del POST y
 * explica el 409 `NOT_CARD_CUSTOMER` sin volver a ofrecer el botón a ese cliente.
 */
const get = vi.fn();
const start = vi.fn();
/** `card_customer` del GET (P149); null = API que no lo dice. */
let cardCustomer: boolean | null = true;
vi.mock(
  "@shared/payment_gateways/services/paymentGateways.service",
  async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    bookingPostcharges: {
      get: (...a: unknown[]) => get(...a),
      lookup: async (...a: unknown[]) => ({ postcharge: await get(...a), cardCustomer }),
      start: (...a: unknown[]) => start(...a),
    },
  }),
);

let scopes: string[] = ["payment_gateways:read", "payment_gateways:write"];
vi.mock("@shared/composables/useAccess", async (orig) => {
  const real = await orig<typeof import("@shared/composables/useAccess")>();
  const { computed } = await import("vue");
  return {
    ...real,
    useAccess: () => ({
      access: computed(() => real.buildAccess({ access: { scopes } })),
    }),
  };
});

import BookingPostchargePanel from "./BookingPostchargePanel.vue";
import { forgetStandardCustomers } from "./bookingPostchargeModel";

const ROW = {
  postcharge_id: "a1b2",
  kind: "express",
  shipment_id: 1001,
  customer_id: 77,
  status: "awaiting_payment",
  method: "invoice",
  description: "Riaddebito peso",
  net: "19.50",
  vat: "4.29",
  total: "23.79",
  currency: "EUR",
  surcharge_id: null,
  invoice_id: 5551,
  crm_id: 42,
  error: "sin autorización de cobro activa",
  created_at: "2026-11-26 10:00:00",
  updated_at: null,
};

function mountPanel(props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  });
  return mount(BookingPostchargePanel, {
    props: {
      kind: "express",
      shipmentId: 1001,
      customerId: 77,
      invoiceId: "120",
      postInvoiceId: "0",
      postAmount: 13,
      ...props,
    },
    global: {
      plugins: [createVuetify({ components, directives }), i18n, pinia],
    },
    attachTo: document.body,
  });
}

beforeEach(() => {
  scopes = ["payment_gateways:read", "payment_gateways:write"];
  get.mockReset();
  start.mockReset();
});
afterEach(() => {
  cardCustomer = true;
  forgetStandardCustomers();
  document.body.innerHTML = "";
});

describe("BookingPostchargePanel", () => {
  it("con postfacturación muestra estado, total con formato local, factura, práctica e incidencia, sin botón", async () => {
    get.mockResolvedValue(ROW);
    const w = mountPanel();
    await flushPromises();
    expect(get).toHaveBeenCalledWith("express", 1001);
    expect(w.find('[data-testid="postcharge-status"]').text()).toBe(
      "payments.postcharge.status.awaiting_payment",
    );
    expect(w.find('[data-testid="postcharge-total"]').text()).toBe("€23.79");
    expect(w.find('[data-testid="postcharge-invoice"]').text()).toContain(
      "#5551",
    );
    expect(w.find('[data-testid="postcharge-crm"]').text()).toContain("#42");
    expect(w.find('[data-testid="postcharge-error"]').exists()).toBe(true);
    expect(w.find('[data-testid="postcharge-start"]').exists()).toBe(false);
  });

  it("sin postfacturación: confirma antes de cobrar y pinta el resultado", async () => {
    get.mockResolvedValue(null);
    start.mockResolvedValue({
      ...ROW,
      status: "notified",
      method: "authorization",
      invoice_id: null,
      crm_id: null,
      error: "",
      replayed: false,
    });
    const w = mountPanel();
    await flushPromises();
    const btn = w.find('[data-testid="postcharge-start"]');
    expect(btn.attributes("disabled")).toBeUndefined();
    await btn.trigger("click");
    await flushPromises();
    expect(start).not.toHaveBeenCalled();
    // El diálogo explica las dos vías.
    expect(document.body.textContent).toContain(
      "payments.postcharge.confirm.with_auth",
    );
    expect(document.body.textContent).toContain(
      "payments.postcharge.confirm.without_auth",
    );
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("payments.postcharge.confirm.submit"),
    );
    confirm!.click();
    await flushPromises();
    expect(start).toHaveBeenCalledWith("express", 1001);
    expect(w.find('[data-testid="postcharge-status"]').text()).toBe(
      "payments.postcharge.status.notified",
    );
  });

  it("botón deshabilitado si el envío no está facturado, con el motivo", async () => {
    get.mockResolvedValue(null);
    const w = mountPanel({ invoiceId: "0" });
    await flushPromises();
    expect(
      w.find('[data-testid="postcharge-start"]').attributes("disabled"),
    ).toBeDefined();
    expect(w.find('[data-testid="postcharge-block"]').text()).toBe(
      "payments.postcharge.block.not_invoiced",
    );
  });

  it("P149: cliente con postfacturación normal (card_customer false) y sin postfacturación: no pinta el panel", async () => {
    cardCustomer = false;
    get.mockResolvedValue(null);
    const w = mountPanel();
    await flushPromises();
    expect(w.find('[data-testid="postcharge-panel"]').exists()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it("NOT_CARD_CUSTOMER con un API que no dice card_customer: lo explica y no vuelve a ofrecer el botón", async () => {
    cardCustomer = null;
    get.mockResolvedValue(null);
    start.mockRejectedValue(
      new ApiError("x", 409, "NOT_CARD_CUSTOMER", {
        code: "NOT_CARD_CUSTOMER",
        error_code: "NOT_CARD_CUSTOMER",
      }),
    );
    const w = mountPanel();
    await flushPromises();
    await w.find('[data-testid="postcharge-start"]').trigger("click");
    await flushPromises();
    Array.from(document.body.querySelectorAll("button"))
      .find((b) =>
        b.textContent?.includes("payments.postcharge.confirm.submit"),
      )!
      .click();
    await flushPromises();
    expect(w.find('[data-testid="postcharge-not-card"]').exists()).toBe(true);
    expect(w.find('[data-testid="postcharge-start"]').exists()).toBe(false);
    w.unmount();

    const again = mountPanel({ shipmentId: 1002 });
    await flushPromises();
    expect(again.find('[data-testid="postcharge-not-card"]').exists()).toBe(
      true,
    );
    expect(again.find('[data-testid="postcharge-start"]').exists()).toBe(false);
  });

  it("solo lectura: sin postfacturación no pinta nada; 403 en el GET oculta el panel", async () => {
    scopes = ["payment_gateways:read"];
    get.mockResolvedValue(null);
    const ro = mountPanel();
    await flushPromises();
    expect(ro.find('[data-testid="postcharge-panel"]').exists()).toBe(false);
    ro.unmount();

    scopes = ["payment_gateways:read", "payment_gateways:write"];
    get.mockRejectedValue(new ApiError("x", 403, "FORBIDDEN"));
    const forbidden = mountPanel();
    await flushPromises();
    expect(forbidden.find('[data-testid="postcharge-panel"]').exists()).toBe(
      false,
    );
  });
});
