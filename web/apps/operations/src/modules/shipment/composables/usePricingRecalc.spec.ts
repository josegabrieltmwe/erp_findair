import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { effectScope, nextTick } from "vue";

const load = vi.fn();
const upsert = vi.fn();
vi.mock("@shipment/services/shipment.service", () => ({
  shipmentService: { load: (...a: unknown[]) => load(...a) },
}));
vi.mock("@shipment/services/addresses.service", () => ({
  addressesService: { upsert: (...a: unknown[]) => upsert(...a) },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));

import { useShipmentStore } from "@shipment/stores/shipment.store";
import { usePricingRecalc } from "./usePricingRecalc";

async function settle(ms = 0): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await nextTick();
}

describe("usePricingRecalc: recargas redundantes", () => {
  let cap = "00100";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    });
    setActivePinia(createPinia());
    load.mockReset();
    upsert.mockReset();
    cap = "00100";
    load.mockImplementation(async () => ({
      success: true,
      data: { id: 7, cap_dest: cap, paese_dest: "IT", peso: "1" },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const store = useShipmentStore();
    const scope = effectScope();
    scope.run(() => usePricingRecalc());
    await store.load(7);
    await settle(10); // arma los watchers tras la primera carga
    load.mockClear();
    return { store, scope };
  }

  it("guardar una dirección produce un único ajax_shipment_crud", async () => {
    const { store, scope } = await setup();
    upsert.mockResolvedValue({ success: true });
    cap = "20100"; // la recarga trae el CAP nuevo
    const ok = await store.saveAddress("D", { cap: "20100" });
    expect(ok).toBe(true);
    await settle(3000);
    expect(load).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("un cambio local de CAP sí programa la recarga del recálculo", async () => {
    const { store, scope } = await setup();
    store.mergeLocal({ cap_dest: "30100" } as never);
    await settle(1500);
    expect(load).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
