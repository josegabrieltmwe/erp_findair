import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { nextTick } from "vue";
import es from "../../../locales/es.json";

const listClient = vi.fn();
const setService = vi.fn();
vi.mock("@shipment/services/service_selection.service", () => ({
  serviceSelectionService: {
    select: vi.fn(),
    listClient: (...a: unknown[]) => listClient(...a),
    listFornitore: vi.fn(),
    clear: vi.fn(),
  },
}));
vi.mock("@shipment/services/fornitori.service", () => ({
  fornitoriService: { setService: (...a: unknown[]) => setService(...a) },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
vi.mock("@shipment/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));
vi.mock("@shipment/stores/shipment.store", async () => {
  const { defineStore } = await import("pinia");
  return {
    useShipmentStore: defineStore("shipment", {
      state: () => ({
        id: 7 as number | null,
        shipment: { id_servizio: 1 } as Record<string, unknown>,
      }),
      actions: { load: vi.fn() },
    }),
  };
});

// AppDialog real usa teleport/overlay: se sustituye por un contenedor simple.
vi.mock("@shared/ui/AppDialog.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "AppDialog",
      props: {
        open: { type: Boolean, default: false },
        title: { type: String, default: "" },
      },
      setup(props, { slots }) {
        return () =>
          props.open
            ? h("div", { class: "dlg" }, [slots.default?.(), slots.actions?.()])
            : null;
      },
    }),
  };
});

import ShipmentServiceClienteModal from "./ShipmentServiceClienteModal.vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";

const vuetify = createVuetify({ components, directives });
const i18n = createI18n({
  legacy: false,
  locale: "es",
  missingWarn: false,
  fallbackWarn: false,
  messages: { es: es as never },
});

const plain = [
  {
    service_id: 1,
    description: "Express",
    available: true,
    price: 50,
    fuel_surcharge: 5,
    currency: "EUR",
    priority: true,
  },
];
const withTc = [
  {
    ...plain[0],
    tempi_certi: {
      cheapest: {
        idsrvfrnt: 10,
        fornitore_id: 3,
        courier: "dhl",
        datacr: "2026-11-20",
        orac: "19:00",
        prezzo: 40,
        prezzof: 4,
        price_total: 50,
      },
      variants: [
        {
          idsrvfrnt: 11,
          fornitore_id: 5,
          courier: "fedex",
          datacr: "2026-11-19",
          orac: "18:00",
          datatxt: "19/11 - 18:00",
          datadtxt: "-1 day",
          prezzo: 60,
          prezzof: 6,
          price_total: 80,
          zona: "Z1",
          sctmin: "+14.20 EUR",
        },
      ],
    },
  },
  {
    service_id: 2,
    description: "Prioritario",
    available: true,
    price: 90,
    currency: "EUR",
    is_priority: true,
  },
];

let wrapper: VueWrapper | null = null;
async function mountModal(open = true) {
  wrapper = mount(ShipmentServiceClienteModal, {
    props: { open: false },
    global: {
      plugins: [vuetify, i18n],
      stubs: {
        RateDebugPanel: true,
        EmptyState: true,
      },
    },
  });
  // El modal carga al pasar `open` a true (watch no inmediato), como en la app.
  if (open) await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

describe("ShipmentServiceClienteModal: tiempos garantizados", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listClient.mockReset();
    setService.mockReset();
    listClient.mockResolvedValue({ success: true, data: { services: plain } });
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it("muestra la acción, sin activar, y la carga inicial no pide la opción", async () => {
    const w = await mountModal();
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(true);
    expect(w.text()).toContain(es.shipment.service.tempi_certi.show);
    expect(w.find('[data-testid="tc-active"]').exists()).toBe(false);
    expect(listClient.mock.calls[0][1].tempi_certi).toBeFalsy();
  });

  it("al pulsarla pide tempi_certi=true, muestra spinner y mantiene la lista anterior", async () => {
    const w = await mountModal();
    let resolve!: (v: unknown) => void;
    listClient.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await w.find('[data-testid="tc-show"]').trigger("click");
    await nextTick();
    expect(listClient.mock.calls[1][1].tempi_certi).toBe(true);
    expect(w.find('[data-testid="tc-progress"]').exists()).toBe(true);
    expect(w.text()).toContain("Express"); // lista anterior visible
    resolve({ success: true, data: { services: withTc } });
    await flushPromises();
    expect(w.find('[data-testid="tc-progress"]').exists()).toBe(false);
    expect(w.find('[data-testid="tc-active"]').exists()).toBe(true);
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(false);
  });

  it("pinta la opción más barata, las variantes (ventaja en días, fecha, price_total) y la insignia de prioritario", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    const w = await mountModal();
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    expect(w.find('[data-testid="tc-cheapest"]').text()).toContain(
      "20/11 - 19:00",
    );
    const variants = w.findAll('[data-testid="tc-variant"]');
    expect(variants).toHaveLength(1);
    const v = variants[0].text();
    expect(v).toContain("1 día antes");
    expect(v).toContain("19/11 - 18:00");
    expect(v).toContain("FedEx");
    expect(variants[0].find('[data-testid="tc-variant-total"]').text()).toMatch(
      /80/,
    );
    expect(w.findAll('[data-testid="priority-badge"]')).toHaveLength(2);
  });

  it("«volver a la lista normal» pide la lista sin la opción", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    const w = await mountModal();
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    await w.find('[data-testid="tc-back"]').trigger("click");
    await flushPromises();
    const last = listClient.mock.calls.at(-1)![1];
    expect(last.tempi_certi).toBeFalsy();
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(true);
  });

  it("al cambiar de envío la opción vuelve al estado por defecto", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    const w = await mountModal();
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    expect(w.find('[data-testid="tc-active"]').exists()).toBe(true);
    (useShipmentStore() as unknown as { id: number }).id = 8;
    await flushPromises();
    expect(w.find('[data-testid="tc-active"]').exists()).toBe(false);
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(true);
    expect(listClient.mock.calls.at(-1)![0]).toBe(8);
    expect(listClient.mock.calls.at(-1)![1].tempi_certi).toBeFalsy();
  });

  it("al cerrar y reabrir el modal la opción no persiste", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    const w = await mountModal();
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await flushPromises();
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(true);
    expect(listClient.mock.calls.at(-1)![1].tempi_certi).toBeFalsy();
  });

  it("avisa si los couriers no respondieron (meta.live_courier.success=false)", async () => {
    const w = await mountModal();
    listClient.mockResolvedValueOnce({
      success: true,
      data: {
        services: plain,
        meta: { live_courier: { success: false, error: "timeout" } },
      },
    });
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    expect(w.find('[data-testid="tc-live-failed"]').text()).toContain(
      es.shipment.service.tempi_certi.live_failed,
    );
  });

  it("si la petición falla mantiene la lista y avisa", async () => {
    const w = await mountModal();
    listClient.mockRejectedValueOnce(new Error("504"));
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    expect(w.find('[data-testid="tc-error"]').exists()).toBe(true);
    expect(w.text()).toContain("Express");
    expect(w.find('[data-testid="tc-show"]').exists()).toBe(true);
  });

  it("elegir una variante del servicio actual pide confirmación y asigna con setService", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    setService.mockResolvedValue({ success: true });
    const w = await mountModal();
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    await w.find('[data-testid="tc-variant"]').trigger("click");
    await nextTick();
    expect(setService).not.toHaveBeenCalled();
    expect(w.find('[data-testid="tc-confirm-body"]').exists()).toBe(true);
    await w.find('[data-testid="tc-confirm-ok"]').trigger("click");
    await flushPromises();
    expect(setService).toHaveBeenCalledWith(7, {
      id_fornitore: 5,
      id_servizio_fornitore: 11,
      cst: 60,
      fuel: 6,
      prvl: undefined,
      apizona: "Z1",
    });
  });

  it("las variantes de un servicio que no es el actual son solo informativas", async () => {
    listClient.mockResolvedValue({ success: true, data: { services: withTc } });
    const w = await mountModal();
    useShipmentStore().shipment = { id: 7, id_servizio: "99" };
    await w.find('[data-testid="tc-show"]').trigger("click");
    await flushPromises();
    await w.find('[data-testid="tc-variant"]').trigger("click");
    await nextTick();
    expect(w.find('[data-testid="tc-confirm-body"]').exists()).toBe(false);
    expect(setService).not.toHaveBeenCalled();
  });
});
