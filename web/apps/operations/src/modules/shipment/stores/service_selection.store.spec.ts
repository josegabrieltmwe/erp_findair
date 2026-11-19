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
const setService = vi.fn();
vi.mock("@shipment/services/fornitori.service", () => ({
  fornitoriService: { setService: (...a: unknown[]) => setService(...a) },
}));
const load = vi.fn();
vi.mock("@shipment/services/shipment.service", () => ({
  shipmentService: { load: (...a: unknown[]) => load(...a), update: vi.fn() },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
// errors.api.READONLY_SHIPMENT: unica traduccion "conocida" en este mock, para
// distinguir "se tradujo" de "se colo el texto crudo del backend" sin acoplar
// el test al catalogo real de i18n.
const TRANSLATED_READONLY = "Proveedor bloqueado: no se puede cambiar.";
vi.mock("@shipment/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (k: string) => (k === "errors.api.READONLY_SHIPMENT" ? TRANSLATED_READONLY : k),
      te: (k: string) => k === "errors.api.READONLY_SHIPMENT",
    },
  },
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

/**
 * F1.4 — assignFornitoreService (api_shipment_set_service) con un 409
 * READONLY_SHIPMENT (fornitore_lk='S'): antes se mostraba el texto crudo del
 * backend en ingles, exponiendo el nombre de columna ("Supplier is locked
 * (fornitore_lk) on this shipment"). Ahora pasa por localizedErrorText.
 */
describe("service_selection.store: candado de proveedor (F1.4)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setService.mockReset();
    load.mockReset();
    load.mockResolvedValue({ success: false });
  });

  it("muestra el texto localizado, no el crudo del backend, cuando el proveedor esta bloqueado", async () => {
    setService.mockRejectedValue(
      Object.assign(
        new Error("Supplier is locked (fornitore_lk) on this shipment"),
        { errorCode: "READONLY_SHIPMENT", status: 409 },
      ),
    );
    const store = useServiceSelectionStore();
    const toasts = useToastStore();

    const ok = await store.assignFornitoreService(7, 8, {
      id_servizio_fornitore: 42,
    });

    expect(ok).toBe(false);
    const errors = toasts.items.filter((t) => t.kind === "error");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe("Proveedor bloqueado: no se puede cambiar.");
    expect(errors[0].message).not.toContain("fornitore_lk");
  });

  it("cae al mensaje crudo si el codigo no tiene traduccion (sin perder el error)", async () => {
    setService.mockRejectedValue(
      Object.assign(new Error("Unexpected failure"), {
        errorCode: "SOME_OTHER_CODE",
        status: 500,
      }),
    );
    const store = useServiceSelectionStore();
    const toasts = useToastStore();

    const ok = await store.assignFornitoreService(7, 8, {
      id_servizio_fornitore: 42,
    });

    expect(ok).toBe(false);
    const errors = toasts.items.filter((t) => t.kind === "error");
    expect(errors[0].message).toBe("Unexpected failure");
  });
});
