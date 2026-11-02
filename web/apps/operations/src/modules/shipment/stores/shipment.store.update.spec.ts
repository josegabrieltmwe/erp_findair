import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const update = vi.fn();
vi.mock("@shipment/services/shipment.service", () => ({
  shipmentService: { update: (...a: unknown[]) => update(...a) },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));

import { useShipmentStore } from "./shipment.store";
import { useToastStore } from "./toast.store";

describe("shipment.store update: campos ignorados por el servidor", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    update.mockReset();
    vi.stubGlobal("window", { setTimeout: () => 0 });
  });

  function setup() {
    const store = useShipmentStore();
    store.shipment = { id: 7, km_forza: "1", note: "a" } as never;
    return { store, toasts: useToastStore() };
  }

  it("avisa y no muestra «Saved» si el servidor ignora el campo", async () => {
    update.mockResolvedValue({
      success: true,
      data: { updated: 0, id: 7, ignored_fields: ["km_forza"] },
    });
    const { store, toasts } = setup();
    const ok = await store.update({ km_forza: "9" } as never);
    expect(ok).toBe(false);
    const kinds = toasts.items.map((t) => t.kind);
    expect(kinds).toContain("warning");
    expect(kinds).not.toContain("success");
    expect((store.shipment as never as { km_forza: string }).km_forza).toBe("1");
  });

  it("guardado completo sigue mostrando «Saved»", async () => {
    update.mockResolvedValue({ success: true, data: { updated: 1, id: 7 } });
    const { store, toasts } = setup();
    expect(await store.update({ note: "b" } as never)).toBe(true);
    expect(toasts.items.map((t) => t.kind)).toEqual(["success"]);
  });
});
