import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

/**
 * ME2 — cockpit.store.ts vive en el paquete compartido (`@shared/dashboard`)
 * pero sus 2 dependencias de red se mockean aquí por la ruta QUE ÉL usa
 * (`./home_kpi.service` relativo a su propia carpeta, resuelto por Vite al
 * mismo módulo que `@shared/dashboard/home_kpi.service` desde este archivo —
 * vi.mock intercepta por módulo resuelto, no por el string literal de cada
 * importador).
 */
const ofetchMock = vi.fn();
vi.mock("ofetch", () => ({
  ofetch: (...args: unknown[]) => ofetchMock(...args),
}));

const fetchKpiCountsMock = vi.fn();
vi.mock("@shared/dashboard/home_kpi.service", () => ({
  fetchKpiCounts: (...args: unknown[]) => fetchKpiCountsMock(...args),
}));

import { useCockpitStore } from "@shared/dashboard/cockpit.store";

const BASE = "/erp/tmwe_json";
const STALE_TTL_MS = 3 * 60_000;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  setActivePinia(createPinia());
  ofetchMock.mockReset();
  fetchKpiCountsMock.mockReset();
  fetchKpiCountsMock.mockResolvedValue({ courier_ops_in: 5, courier_ops_out: 3 });
  ofetchMock.mockResolvedValue({ indicators: { open_cases: 2 } });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cockpit store (ME2 — stale-while-revalidate)", () => {
  it("un grupo recién cargado no se vuelve a pedir dentro del TTL", async () => {
    const store = useCockpitStore();
    store.ensureCategories(["courier_ops_in"], BASE);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(1);
    expect(store.counts.courier_ops_in).toBe(5);
    expect(store.pending.size).toBe(0);

    store.ensureCategories(["courier_ops_in"], BASE);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(1);
  });

  it("un grupo nunca pedido marca pending (spinner); uno revalidado en silencio tras vencer el TTL no", async () => {
    const store = useCockpitStore();
    store.ensureCategories(["courier_ops_in"], BASE);
    // Justo después de encolar, ANTES de que resuelva el fetch — debe mostrar spinner.
    expect(store.pending.has("courier_ops_in")).toBe(true);
    await flush();
    expect(store.pending.has("courier_ops_in")).toBe(false);

    vi.setSystemTime(Date.now() + STALE_TTL_MS + 1000);
    store.ensureCategories(["courier_ops_in"], BASE);
    // Revalidación en silencio: NUNCA marca pending, aunque dispare un fetch nuevo.
    expect(store.pending.has("courier_ops_in")).toBe(false);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(2);
    expect(store.counts.courier_ops_in).toBe(5);
  });

  it("forceRefresh (botón de retry) ignora el TTL", async () => {
    const store = useCockpitStore();
    store.ensureCategories(["courier_ops_in"], BASE);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(1);

    store.forceRefresh(["courier_ops_in"], BASE);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(2);
  });

  it("QW6 sigue vigente dentro del store: 2 grupos de indicadores nunca pedidos se funden en 1 sola llamada", async () => {
    ofetchMock.mockResolvedValue({ indicators: { open_cases: 2, retraso: 7 } });
    const store = useCockpitStore();
    store.ensureCategories(["assist", "tracking_indicators"], BASE);
    await flush();
    expect(ofetchMock).toHaveBeenCalledTimes(1);
    const url = ofetchMock.mock.calls[0][0] as string;
    expect(url).toContain("open_cases");
    expect(url).toContain("retraso");
    expect(store.counts.open_cases).toBe(2);
    expect(store.counts.retraso).toBe(7);
  });

  it("un error no cachea un valor obsoleto como si fuera fresco (sigue recomputando)", async () => {
    fetchKpiCountsMock.mockRejectedValueOnce(new Error("boom"));
    const store = useCockpitStore();
    store.ensureCategories(["courier_ops_in"], BASE);
    await flush();
    expect(store.errors.courier_ops_in).toContain("boom");
    expect(store.pending.has("courier_ops_in")).toBe(false);

    fetchKpiCountsMock.mockResolvedValue({ courier_ops_in: 9, courier_ops_out: 1 });
    store.ensureCategories(["courier_ops_in"], BASE);
    await flush();
    expect(fetchKpiCountsMock).toHaveBeenCalledTimes(2);
    expect(store.counts.courier_ops_in).toBe(9);
    expect(store.errors.courier_ops_in).toBeUndefined();
  });
});
