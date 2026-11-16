import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { createI18n } from "vue-i18n";
import { createPinia, setActivePinia } from "pinia";

/**
 * N26 (collaudo 16/11): "Ricalcola prezzo" calculaba bien el precio cliente
 * (se veia en el toast) pero lo escribia en `original.prezzo` -- un alias
 * que ni la tabla (pinta fix_priceC) ni el guardado (Shipment_Supplements_
 * Controller lee fix_priceC/fix_priceF) usan -- y nunca llamaba a
 * saveSupplements. La columna "Prezzo cliente" seguia vacia siempre.
 *
 * Test de MONTAJE real (DOM via happy-dom): a diferencia de un test sobre
 * supplements.service.ts, esto comprueba que el click de verdad deja el
 * valor en el input visible Y dispara el guardado.
 */
const calculate = vi.fn();
const upsertAll = vi.fn();
const list = vi.fn();
const prices = vi.fn();
vi.mock("@shipment/services/supplements.service", () => ({
  supplementsService: {
    calculate: (...a: unknown[]) => calculate(...a),
    upsertAll: (...a: unknown[]) => upsertAll(...a),
    list: (...a: unknown[]) => list(...a),
    prices: (...a: unknown[]) => prices(...a),
  },
}));
vi.mock("@shipment/services/http", () => ({ http: vi.fn() }));

import { useShipmentStore } from "@shipment/stores/shipment.store";
import ShipmentSupplementsBox from "./ShipmentSupplementsBox.vue";

const SHIPMENT_ID = 1001087661;

function mountBox() {
  const vuetify = createVuetify({ components, directives });
  const i18n = createI18n({
    legacy: false,
    locale: "it",
    missingWarn: false,
    fallbackWarn: false,
    messages: { it: {} },
  });
  const pinia = createPinia();
  setActivePinia(pinia);

  const store = useShipmentStore();
  // Mismo patron que stores/shipment.store.update.spec.ts: setear
  // store.shipment directamente, sin pasar por load().
  store.shipment = {
    id: SHIPMENT_ID,
    supplements: [
      {
        id: 402110,
        id_spedizione: SHIPMENT_ID,
        id_supplementi: 26,
        attivo: "S",
        delta: "N",
        fix_priceC: null,
        fix_priceF: 0,
        descrizione: "Area remota",
      },
    ],
  } as never;

  const wrapper = mount(ShipmentSupplementsBox, {
    global: { plugins: [vuetify, i18n, pinia] },
    attachTo: document.body,
  });
  return { wrapper, store };
}

describe("ShipmentSupplementsBox: Ricalcola prezzo (N26)", () => {
  it("escribe el precio calculado en fix_priceC (la columna visible) y lo guarda", async () => {
    calculate.mockResolvedValue({ success: true, prezzo: 12.5 });
    upsertAll.mockResolvedValue({ success: true });
    // El refresh posterior al guardado pide la lista de nuevo: simula que el
    // backend ya persistio el precio (como haria de verdad), para distinguir
    // "se guardo" de "el mock simplemente no borro nada".
    list.mockResolvedValue({
      success: true,
      data: {
        shipment_id: SHIPMENT_ID,
        supplements: [
          {
            id: 402110,
            id_spedizione: SHIPMENT_ID,
            id_supplementi: 26,
            attivo: "S",
            delta: "N",
            fix_priceC: 12.5,
            fix_priceF: 0,
            descrizione: "Area remota",
          },
        ],
        count: 1,
      },
    });

    const { wrapper, store } = mountBox();
    await flushPromises();

    const btns = wrapper.findAll("button");
    const btn = btns.find((b) => b.html().includes("mdi-calculator-variant-outline"));
    expect(btn).toBeTruthy();
    await btn!.trigger("click");
    await flushPromises();

    // 1) El precio calculado queda en fix_priceC, no en el alias "prezzo" sin uso.
    const row = (store.supplements as unknown as Array<Record<string, unknown>>)[0];
    expect(String(row.fix_priceC)).toBe("12.5");

    // 2) Se persiste de verdad: upsertAll recibe fix_priceC, no solo "prezzo".
    expect(upsertAll).toHaveBeenCalledTimes(1);
    const [sentId, sentItems] = upsertAll.mock.calls[0] as [number, Array<Record<string, unknown>>];
    expect(sentId).toBe(SHIPMENT_ID);
    expect(String(sentItems[0].fix_priceC)).toBe("12.5");

    // 3) Y el input visible (columna "Prezzo cliente") ya no esta vacio.
    const priceInput = wrapper
      .findAll("input")
      .find((inp) => (inp.element as HTMLInputElement).value === "12.5");
    expect(priceInput).toBeTruthy();

    wrapper.unmount();
  });
});
