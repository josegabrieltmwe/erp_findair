import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const select = vi.fn();
vi.mock("@shipment/services/service_selection.service", () => ({
  serviceSelectionService: {
    select: (...a: unknown[]) => select(...a),
    listClient: vi.fn(),
    listFornitore: vi.fn(),
    clear: vi.fn(),
  },
}));
vi.mock("@shipment/services/fornitori.service", () => ({
  fornitoriService: { setService: vi.fn() },
}));
const load = vi.fn();
vi.mock("@shipment/services/shipment.service", () => ({
  shipmentService: { load: (...a: unknown[]) => load(...a), update: vi.fn() },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
vi.mock("@shipment/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { useServiceSelectionStore } from "./service_selection.store";
import { useToastStore } from "./toast.store";

/**
 * N28 — al guardar/recalcular una spedizione express, el backend puede
 * devolver `cost_needs_review: true` + `supplier: {before, after, changed}`
 * cuando el proveedor cambió de verdad (no por LDV fija): el coste guardado
 * sigue siendo del proveedor anterior y no se recalculó solo. El operador
 * debe verlo — aviso (toast persistente) + notice que la vista de detalle
 * puede mostrar hasta que se descarte.
 */
describe("service_selection.store: aviso de revisión de coste (N28)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    select.mockReset();
    load.mockReset();
    load.mockResolvedValue({ success: false });
    vi.stubGlobal("window", { setTimeout: () => 0 });
  });

  it("avisa y mantiene el notice cuando cost_needs_review es true", async () => {
    select.mockResolvedValue({
      success: true,
      data: {
        shipment_id: 7,
        service_applied: true,
        service: { id: 1, description: "Express" },
        price_locked: false,
        supplier: { before: 3, after: 9, changed: true },
        cost_needs_review: true,
      },
    });
    const store = useServiceSelectionStore();
    const toasts = useToastStore();

    const ok = await store.selectAndCascade(7, 1);

    expect(ok).toBe(true);
    expect(store.costReviewNotice).toEqual({
      before: 3,
      after: 9,
      changed: true,
    });
    const warnings = toasts.items.filter((t) => t.kind === "warning");
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain("#3");
    expect(warnings[0].message).toContain("#9");
    // Es un aviso persistente post-guardado, no bloqueante: timeout 0 (no
    // desaparece solo) y la operación ya se reportó como success.
    expect(warnings[0].timeout).toBe(0);
  });

  it("no avisa cuando cost_needs_review es false", async () => {
    select.mockResolvedValue({
      success: true,
      data: {
        shipment_id: 7,
        service_applied: true,
        service: { id: 1, description: "Express" },
        price_locked: false,
        supplier: { before: 3, after: 3, changed: false },
        cost_needs_review: false,
      },
    });
    const store = useServiceSelectionStore();
    const toasts = useToastStore();

    const ok = await store.selectAndCascade(7, 1);

    expect(ok).toBe(true);
    expect(store.costReviewNotice).toBeNull();
    expect(toasts.items.some((t) => t.kind === "warning")).toBe(false);
  });

  it("no avisa cuando cost_needs_review está ausente de la respuesta", async () => {
    select.mockResolvedValue({
      success: true,
      data: {
        shipment_id: 7,
        service_applied: true,
        service: { id: 1, description: "Express" },
        price_locked: false,
      },
    });
    const store = useServiceSelectionStore();
    const toasts = useToastStore();

    await store.selectAndCascade(7, 1);

    expect(store.costReviewNotice).toBeNull();
    expect(toasts.items.some((t) => t.kind === "warning")).toBe(false);
  });

  it("dismissCostReview limpia el aviso", async () => {
    select.mockResolvedValue({
      success: true,
      data: {
        shipment_id: 7,
        service_applied: true,
        service: null,
        price_locked: false,
        supplier: { before: 3, after: 9, changed: true },
        cost_needs_review: true,
      },
    });
    const store = useServiceSelectionStore();
    await store.selectAndCascade(7, 1);
    expect(store.costReviewNotice).not.toBeNull();

    store.dismissCostReview();

    expect(store.costReviewNotice).toBeNull();
  });
});
