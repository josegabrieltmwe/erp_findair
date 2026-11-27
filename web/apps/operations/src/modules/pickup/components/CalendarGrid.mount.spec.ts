import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import CalendarGrid from "./CalendarGrid.vue";
import type { Pickup } from "../types";

/**
 * Calendario de presas, vista de día (rejilla autista × media hora): con `showAddress` cada presa lleva el nombre,
 * la dirección y el contacto, como el tablero de autistas; sin él, o con un API que no manda `direccion`, solo el
 * número, como antes. Fixtures sintéticas.
 */
function pickup(over: Partial<Pickup> = {}): Pickup {
  return {
    id: 201,
    id_sede: 7,
    id_contatti: 5,
    data: "2026-11-27 09:00:00",
    address_sped: "S",
    presa_fissa: "N",
    affidata: "S",
    n_colli: 1,
    peso: 2,
    note: null,
    stato: "A",
    driver: { id: 5, nome: "Mario" },
    direccion: {
      origen: "expedicion",
      nombre: "Mittente",
      indirizzo: "Via Codara 1",
      cap: "20144",
      citta: "Milano",
      prov: "MI",
      paese: "IT",
      tel: "333 1234",
      contacto: "Sig. Rossi",
      email: "rossi@mitt.example",
      cliente: "ACME SRL",
    },
    ...over,
  };
}

function mountGrid(pickups: Pickup[], showAddress: boolean) {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  });
  return mount(CalendarGrid, {
    props: { pickups, showAddress },
    global: { plugins: [createVuetify({ components, directives }), i18n] },
  });
}

describe("CalendarGrid — dirección y contacto", () => {
  it("con showAddress pinta nombre, dirección y contacto; el resto al pasar el ratón", () => {
    const w = mountGrid([pickup()], true);
    const chip = w.get('[data-testid="cal-pickup"]');
    expect(chip.get('[data-testid="cal-name"]').text()).toBe("Mittente");
    expect(chip.get('[data-testid="cal-address"]').text()).toContain(
      "Via Codara 1, 20144 Milano (MI)",
    );
    expect(chip.get('[data-testid="cal-contact"]').text()).toBe(
      "Sig. Rossi · 333 1234",
    );
    const title = chip.attributes("title") ?? "";
    expect(title).toContain("pickup.schedule.origin.expedicion");
    expect(title).toContain("pickup.schedule.client");
    expect(title).toContain("pickup.schedule.email");
  });

  it("sin showAddress, o sin direccion en el API, solo el número", () => {
    const off = mountGrid([pickup()], false).get('[data-testid="cal-pickup"]');
    expect(off.text()).toBe("#201");
    expect(off.attributes("title")).toBeUndefined();

    const old = mountGrid([pickup({ direccion: undefined })], true).get(
      '[data-testid="cal-pickup"]',
    );
    expect(old.text()).toBe("#201");
  });
});
