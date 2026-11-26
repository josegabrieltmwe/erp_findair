import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

/**
 * U-15, test de MONTAJE: el tablero de autistas pinta la dirección junto a cada número de presa (sede o
 * expedición, con su icono y aviso), el interruptor vuelve al tablero compacto y se recuerda, y con un API que no
 * manda `direccion` se ve solo el número, como antes.
 */
const list = vi.fn();
vi.mock("../services/pickups.service", () => ({
  pickupsService: {
    availableDrivers: async () => [{ id: 5, nome: "Mario" }],
    list: (...a: unknown[]) => list(...a),
    assignDriver: vi.fn(),
  },
}));
vi.mock("@shared/utils/date", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  todayLocal: () => "2026-11-26",
}));

import DriverScheduleBoardPage from "./DriverScheduleBoardPage.vue";

const BASE = {
  id_sede: 7,
  address_sped: "N",
  presa_fissa: "N",
  affidata: "S",
  n_colli: 2,
  peso: 5,
  note: null,
  stato: "A",
  sede: { id: 7, label: "Sede Milano" },
};

function rows() {
  return [
    {
      ...BASE,
      id: 101,
      id_contatti: 5,
      data: "2026-11-26 09:00:00",
      direccion: {
        origen: "sede",
        nombre: "ACME SRL",
        indirizzo: "Via Roma 12",
        cap: "20121",
        citta: "Milano",
        prov: "MI",
        paese: "",
      },
    },
    {
      ...BASE,
      id: 102,
      id_contatti: 5,
      address_sped: "S",
      data: "2026-11-26 10:00:00",
      direccion: {
        origen: "expedicion",
        nombre: "Mittente",
        indirizzo: "Via Codara 1",
        cap: "20144",
        citta: "Milano",
        prov: "MI",
        paese: "IT",
      },
    },
    {
      ...BASE,
      id: 103,
      id_contatti: 0,
      address_sped: "S",
      data: "2026-11-26 11:00:00",
      direccion: {
        origen: "sede_sin_expedicion",
        nombre: "ACME SRL",
        indirizzo: "Via Roma 12",
        cap: "20121",
        citta: "Milano",
        prov: "MI",
        paese: "",
      },
    },
  ];
}

function mountBoard() {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  });
  return mount(DriverScheduleBoardPage, {
    global: { plugins: [createVuetify({ components, directives }), i18n] },
    attachTo: document.body,
  });
}

function card(w: ReturnType<typeof mountBoard>, id: number) {
  return w
    .findAll('[data-testid="board-pickup"]')
    .find((c) => c.text().includes(`#${id}`))!;
}

beforeEach(() => {
  localStorage.clear();
  list.mockReset();
  list.mockResolvedValue({ success: true, data: rows(), pagination: {} });
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("DriverScheduleBoardPage — direcciones (U-15)", () => {
  it("cada presa del autista lleva su dirección; la completa al pasar el ratón", async () => {
    const w = mountBoard();
    await flushPromises();

    const sede = card(w, 101);
    expect(sede.find('[data-testid="board-address"]').text()).toContain(
      "Via Roma 12, 20121 Milano (MI)",
    );
    expect(
      sede
        .find('[data-testid="board-address-origin"]')
        .attributes("data-origin"),
    ).toBe("sede");
    expect(sede.attributes("title")).toContain("ACME SRL · Via Roma 12");

    const sped = card(w, 102);
    expect(sped.text()).toContain("Via Codara 1, 20144 Milano (MI)");
    expect(
      sped
        .find('[data-testid="board-address-origin"]')
        .attributes("data-origin"),
    ).toBe("expedicion");
    expect(sped.attributes("title")).toContain(
      "pickup.schedule.origin.expedicion",
    );
  });

  it("las sin asignar también; la caída a la sede se marca", async () => {
    const w = mountBoard();
    await flushPromises();
    const un = card(w, 103);
    expect(un.text()).toContain("Via Roma 12");
    expect(
      un.find('[data-testid="board-address-origin"]').attributes("data-origin"),
    ).toBe("sede_sin_expedicion");
    expect(un.attributes("title")).toContain(
      "pickup.schedule.origin.sede_sin_expedicion",
    );
  });

  it("el interruptor quita las direcciones y se recuerda", async () => {
    const w = mountBoard();
    await flushPromises();
    await w.find('[data-testid="board-show-addresses"] input').setValue(false);
    await flushPromises();
    expect(w.find('[data-testid="board-address"]').exists()).toBe(false);
    expect(card(w, 103).text()).toContain("Sede Milano");
    expect(localStorage.getItem("tmwe:pickup-board-show-addresses")).toBe("0");
    w.unmount();

    const again = mountBoard();
    await flushPromises();
    expect(again.find('[data-testid="board-address"]').exists()).toBe(false);
  });

  it("con un API que no manda direccion se ve solo el número, como antes", async () => {
    list.mockResolvedValue({
      success: true,
      data: rows().map((r) => {
        const copy: Record<string, unknown> = { ...r };
        delete copy.direccion;
        return copy;
      }),
      pagination: {},
    });
    const w = mountBoard();
    await flushPromises();
    expect(w.find('[data-testid="board-address"]').exists()).toBe(false);
    expect(card(w, 101).text()).toBe("#101");
    expect(card(w, 103).text()).toContain("#103 · Sede Milano · 2");
  });
});
