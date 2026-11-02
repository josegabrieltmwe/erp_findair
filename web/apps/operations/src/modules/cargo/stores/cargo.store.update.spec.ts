import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const update = vi.fn();
vi.mock("@cargo/services/cargo.service", async (orig) => {
  const mod = (await orig()) as Record<string, unknown>;
  return {
    ...mod,
    cargoService: {
      ...(mod.cargoService as object),
      update: (...a: unknown[]) => update(...a),
    },
  };
});
vi.mock("@cargo/services/http", () => ({ http: vi.fn() }));
vi.mock("@cargo/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { useCargoStore } from "./cargo.store";
import { useToastStore } from "./toast.store";

describe("cargo.store update directo (H16d)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    update.mockReset();
    vi.stubGlobal("window", { setTimeout: () => 0 });
  });

  function setup() {
    const store = useCargoStore();
    store.cargo = { id: 9, peso: "10" } as never;
    return { store, toasts: useToastStore() };
  }

  it("un importe negativo no llega al servidor", async () => {
    const { store, toasts } = setup();
    const ok = await store.update({ peso: "-5" } as never);
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(toasts.items.map((t) => t.kind)).toContain("error");
  });

  it("un valor no numerico tampoco", async () => {
    const { store } = setup();
    expect(await store.update({ peso: "abc" } as never)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("un valor valido se envia", async () => {
    update.mockResolvedValue({ success: true, data: {} });
    const { store } = setup();
    expect(await store.update({ peso: "12.5" } as never)).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
