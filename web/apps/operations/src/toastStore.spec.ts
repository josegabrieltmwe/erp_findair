import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
// Las dos rutas por las que se importa el store (packages/platform y la antigua de anagrafiche).
import { useToastStore } from "../../../packages/platform/stores/toast.store";
import { useToastStore as useLegacyToastStore } from "../../../packages/platform/anagrafiche/stores/toast.store";

describe("toast store unico", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("las dos rutas dan el mismo store y las dos formas de llamarlo funcionan", () => {
    const a = useToastStore();
    const b = useLegacyToastStore();
    expect(a).toBe(b);
    b.error("fallo");
    a.push("success", "ok");
    expect(a.items.map((t) => t.kind)).toEqual(["error", "success"]);
    expect(b.toasts).toEqual(a.items);
  });

  it("un error no se cierra solo; un exito si", () => {
    const s = useToastStore();
    s.error("FedEx ha rechazado el envio");
    s.success("Guardado");
    vi.advanceTimersByTime(10_000);
    expect(s.items.map((t) => t.kind)).toEqual(["error"]);
  });

  it("el mismo aviso no se apila mientras sigue visible", () => {
    const s = useToastStore();
    const first = s.error("Server error");
    const second = s.error("Server error");
    expect(second).toBe(first);
    expect(s.items).toHaveLength(1);
  });
});
