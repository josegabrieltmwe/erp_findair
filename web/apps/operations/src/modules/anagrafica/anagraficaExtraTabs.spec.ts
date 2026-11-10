import { afterEach, describe, expect, it, vi } from "vitest";

// Este spec prueba solo la lógica de visibilidad (función pura), no el
// render — el vitest.config.ts de este paquete es para "lógica pura
// (servicios, stores, modelos)" sin plugin de Vue/Vuetify, así que los
// componentes .vue que importa anagraficaExtraTabs.ts se mockean para poder
// parsear el módulo sin un loader de SFC.
vi.mock("@/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));
vi.mock(
  "@shared/air_carrier_credentials/feature/AirCarrierCredentialsPartnerTab.vue",
  () => ({ default: {} }),
);
vi.mock(
  "@shared/webcargo_key/feature/WebcargoCredentialsPartnerTab.vue",
  () => ({ default: {} }),
);
vi.mock("@shared/fornitori_accnt/feature/FornitoriAccntPartnerTab.vue", () => ({
  default: {},
}));
vi.mock("@shared/ai_credentials/feature/AiCredentialsPartnerTab.vue", () => ({
  default: {},
}));
vi.mock("@shared/partner_smtp/feature/PartnerSmtpPartnerTab.vue", () => ({
  default: {},
}));
vi.mock(
  "@/modules/invoicing/components/fiscal/DatosFiscalesAnagraficaTab.vue",
  () => ({ default: {} }),
);

const { anagraficaExtraTabs } = await import("./anagraficaExtraTabs");

/**
 * "webcargo" y "fornitori_accnt" pegan contra backends admin_only
 * incondicional (api_admin_webcargo_key, api_admin_fornitori_accnt): solo
 * TMWE puede llamarlos. Antes se mostraban también a un partner, que
 * siempre recibía 403 al abrirlas (recorrido UI 2026-11-09). El resto de
 * pestañas de este array no deben verse afectadas por el flag TMWE.
 */
function setWindow(isTmwe: boolean | undefined) {
  (globalThis as unknown as { window: unknown }).window = {
    __TMWE_OPERATIONS__: isTmwe === undefined ? undefined : { isTmwe },
  };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

function visibility(record: { tipo?: string } = { tipo: "P" }) {
  const tabs = anagraficaExtraTabs();
  const out: Record<string, boolean> = {};
  for (const tab of tabs) {
    out[tab.key] = tab.visible ? tab.visible(record) : true;
  }
  return out;
}

describe("anagraficaExtraTabs", () => {
  it("un partner no ve webcargo ni fornitori_accnt", () => {
    setWindow(false);
    const v = visibility();
    expect(v.webcargo).toBe(false);
    expect(v.fornitori_accnt).toBe(false);
  });

  it("TMWE sí ve webcargo y fornitori_accnt", () => {
    setWindow(true);
    const v = visibility();
    expect(v.webcargo).toBe(true);
    expect(v.fornitori_accnt).toBe(true);
  });

  it("sin bootstrap (__TMWE_OPERATIONS__ ausente) se trata como no-TMWE", () => {
    setWindow(undefined);
    const v = visibility();
    expect(v.webcargo).toBe(false);
    expect(v.fornitori_accnt).toBe(false);
  });

  it("las demás pestañas no cambian con el flag TMWE", () => {
    setWindow(false);
    const sinTmwe = visibility({ tipo: "P" });
    setWindow(true);
    const conTmwe = visibility({ tipo: "P" });
    for (const key of [
      "air_carrier_credentials",
      "ai_credentials",
      "partner_smtp",
      "datos_fiscales",
    ]) {
      expect(conTmwe[key]).toBe(sinTmwe[key]);
    }
  });
});
