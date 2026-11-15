import { describe, expect, it, vi, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

/**
 * N24 (collaudo): antes de este cambio, crear un avance de pratica mandaba
 * SIEMPRE un email al cliente, sin que el operador lo supiera ni lo
 * decidiera. Se añade un interruptor "Avisar al cliente" (v-switch),
 * APAGADO por defecto, en el formulario de alta de evento de
 * CrmEventiSection.vue.
 *
 * Este es un test de MONTAJE real (sufijo `.mount.spec.ts`, ver
 * `environmentMatchGlobs` en apps/operations/vitest.config.ts): comprueba
 * que el v-switch REALMENTE aparece desmarcado en el DOM y que, al enviar el
 * formulario, el valor del interruptor llega tal cual al store como el 4º
 * argumento de `addEvent` (idCrm, descriz, stato, notifyCustomer) — ese
 * valor es el que crm.service.ts manda como `notify_customer` en el body de
 * POST /api_crm_events (ver crm.service.spec.ts para el payload exacto).
 *
 * Se mockea useCrmStore completo: el objetivo aquí es la UI (el switch y su
 * wiring hacia el store), no la lógica interna del store (contexto de
 * mutación, recarga de eventos/cabecera…), que no es el objeto bajo prueba.
 */
const addEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("../stores/crm.store", () => ({
  useCrmStore: () => ({
    events: [],
    addEvent,
    removeEvent: vi.fn(),
    updateEvent: vi.fn(),
  }),
}));

import CrmEventiSection from "./CrmEventiSection.vue";

const vuetify = createVuetify({ components, directives });
const i18n = createI18n({
  legacy: false,
  locale: "es",
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    es: {
      crm: {
        stato: { A: "Abierta", C: "Cerrada", L: "Larga espera" },
        eventi: {
          title: "Eventos / avances",
          stato: "Estado",
          descriz: "Descripción del avance",
          data: "Fecha y hora",
          view: "Ver detalle",
          detail_title: "Detalle del avance #{id}",
          add: "Añadir",
          empty: "Sin eventos todavía",
          delete_confirm: "¿Eliminar este avance? No se puede deshacer.",
          notify_customer: "Avisar al cliente",
        },
      },
      common: { delete: "Eliminar", cancel: "Cancelar", save: "Guardar" },
    },
  },
});

let mounted: VueWrapper[] = [];

function mountSection(): VueWrapper {
  const wrapper = mount(CrmEventiSection, {
    props: { idCrm: 10 },
    global: { plugins: [vuetify, i18n, createPinia()] },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

/** El v-switch del interruptor "Avisar al cliente" (único switch del formulario). */
function findNotifySwitch(wrapper: VueWrapper) {
  return wrapper.find('input[type="checkbox"]');
}

/**
 * El campo de descripción ("Descripción del avance"): hay DOS
 * `input[type="text"]` en el formulario porque el v-select de estado
 * también renderiza un input de tipo texto (combobox) para su valor
 * seleccionado — el de descripción es el segundo.
 */
function findDescrizInput(wrapper: VueWrapper) {
  return wrapper.findAll('input[type="text"]')[1];
}

describe("CrmEventiSection: interruptor 'Avisar al cliente' (N24)", () => {
  afterEach(() => {
    addEvent.mockClear();
    for (const wrapper of mounted) wrapper.unmount();
    mounted = [];
  });

  it("aparece desmarcado por defecto", () => {
    const wrapper = mountSection();

    expect(wrapper.text()).toContain("Avisar al cliente");
    const switchInput = findNotifySwitch(wrapper);
    expect(switchInput.exists()).toBe(true);
    expect((switchInput.element as HTMLInputElement).checked).toBe(false);
  });

  it("marcado y enviado: el store.addEvent recibe notifyCustomer=true (payload notify_customer: true)", async () => {
    const wrapper = mountSection();

    await findNotifySwitch(wrapper).setValue(true);
    await findDescrizInput(wrapper).setValue("Llamada al cliente");
    await wrapper.find("button.v-btn").trigger("click");
    await flushPromises();

    expect(addEvent).toHaveBeenCalledTimes(1);
    expect(addEvent).toHaveBeenCalledWith(10, "Llamada al cliente", "A", true);
  });

  it("sin marcar: el store.addEvent recibe notifyCustomer=false (payload notify_customer: false, no se omite)", async () => {
    const wrapper = mountSection();

    await findDescrizInput(wrapper).setValue("Nota interna");
    const addButton = wrapper
      .findAll("button")
      .find((b) => b.text() === "Añadir");
    await addButton?.trigger("click");
    await flushPromises();

    expect(addEvent).toHaveBeenCalledTimes(1);
    expect(addEvent).toHaveBeenCalledWith(10, "Nota interna", "A", false);
  });
});
