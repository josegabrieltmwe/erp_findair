import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

/**
 * U-19: la pestaña del borderò que abre el icono de impresora del tablero. Carga el manifiesto del autista y la
 * fecha del enlace y lanza la impresión (como `bordero.php` del legado); sin paradas no imprime y lo dice; un
 * enlace incompleto no llama al API. Fixtures sintéticas.
 */
const manifest = vi.fn();
vi.mock("../services/driver.service", () => ({
  driverService: { manifest: (...a: unknown[]) => manifest(...a) },
}));
vi.mock("../components/DriverManifestSheet.vue", () => ({
  default: { props: ["manifest"], template: '<div data-testid="sheet" />' },
}));

import DriverManifestPrintPage from "./DriverManifestPrintPage.vue";

const MANIFEST = {
  date: "2026-11-27",
  driver: { id: 5, nome: "Mario", cell: "", tel: "" },
  summary: {},
  stops: [{ pickup_id: 1 }],
};

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/pickup/manifest-print", component: DriverManifestPrintPage },
    ],
  });
  await router.push(url);
  await router.isReady();
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  });
  const w = mount(
    { template: "<router-view />" },
    {
      global: {
        plugins: [createVuetify({ components, directives }), i18n, router],
      },
    },
  );
  await flushPromises();
  return w;
}

let print: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  manifest.mockReset();
  print = vi.spyOn(window, "print").mockImplementation(() => undefined);
});
afterEach(() => {
  print.mockRestore();
  vi.useRealTimers();
});

describe("DriverManifestPrintPage", () => {
  it("carga el borderò del autista y la fecha y lanza la impresión", async () => {
    manifest.mockResolvedValue(MANIFEST);
    const w = await mountAt(
      "/pickup/manifest-print?driver_id=5&date=2026-11-27",
    );
    expect(manifest).toHaveBeenCalledWith(5, "2026-11-27");
    expect(w.find('[data-testid="sheet"]').exists()).toBe(true);
    vi.runAllTimers();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("print=0 enseña el borderò sin abrir la impresión", async () => {
    manifest.mockResolvedValue(MANIFEST);
    await mountAt("/pickup/manifest-print?driver_id=5&date=2026-11-27&print=0");
    vi.runAllTimers();
    expect(print).not.toHaveBeenCalled();
  });

  it("sin paradas no imprime y lo dice", async () => {
    manifest.mockResolvedValue({ ...MANIFEST, stops: [] });
    const w = await mountAt(
      "/pickup/manifest-print?driver_id=5&date=2026-11-27",
    );
    vi.runAllTimers();
    expect(w.find('[data-testid="manifest-print-empty"]').exists()).toBe(true);
    expect(print).not.toHaveBeenCalled();
  });

  it("un enlace sin autista o con fecha mal formada no llama al API", async () => {
    const w = await mountAt("/pickup/manifest-print?date=27/11/2026");
    expect(manifest).not.toHaveBeenCalled();
    expect(w.find('[data-testid="manifest-print-error"]').exists()).toBe(true);
  });
});
