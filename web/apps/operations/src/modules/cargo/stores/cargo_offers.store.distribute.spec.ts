import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const distribute = vi.fn();
const list = vi.fn();
vi.mock("@cargo/services/cargo_offers.service", () => ({
  cargoOffersService: {
    distribute: (...a: unknown[]) => distribute(...a),
    list: (...a: unknown[]) => list(...a),
  },
}));
vi.mock("@cargo/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (k: string, p?: Record<string, unknown>) => `${k}:${JSON.stringify(p ?? {})}`,
    },
  },
}));

import { useCargoOffersStore } from "./cargo_offers.store";
import { useToastStore } from "./toast.store";

const body = { cargo_id: 7, carriers: ["KL", "AF", "LH"] };

function row(sigla: string, status: "sent" | "failed", error: string | null = null) {
  return { sigla, nombre: sigla, to: `${sigla}@x.test`, status, offer_id: status === "sent" ? 1 : null, request_id: null, error, error_code: null };
}

describe("cargo_offers.store · distribute (resultado por aerolínea)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    distribute.mockReset();
    list.mockReset();
    list.mockResolvedValue({ success: true, data: { cargo_id: 7, offers: [], count: 0 } });
  });

  it("todas enviadas: ok y toast de éxito", async () => {
    distribute.mockResolvedValue({
      success: true,
      data: { cargo_id: 7, sent: 3, errors: [], results: [row("KL", "sent"), row("AF", "sent"), row("LH", "sent")] },
    });
    const outcome = await useCargoOffersStore().distribute(7, body);
    expect(outcome).toMatchObject({ ok: true, sent: 3, failed: [] });
    expect(useToastStore().items.map((t) => t.kind)).toEqual(["success"]);
  });

  it("envío parcial: NO es ok, nombra las fallidas y avisa con warning", async () => {
    distribute.mockResolvedValue({
      success: true,
      data: {
        cargo_id: 7,
        sent: 2,
        errors: ["AF: Carrier email not found for partner"],
        results: [row("KL", "sent"), row("AF", "failed", "Carrier email not found for partner"), row("LH", "sent")],
      },
    });
    const outcome = await useCargoOffersStore().distribute(7, body);
    expect(outcome).toMatchObject({ ok: false, sent: 2, failed: ["AF"] });
    const toasts = useToastStore().items;
    expect(toasts.map((t) => t.kind)).toEqual(["warning"]);
    expect(toasts[0].message).toContain("AF (AF): Carrier email not found for partner");
    expect(toasts[0].message).toContain('"total":3');
  });

  it("sin results (API antiguo) deduce las fallidas de errors", async () => {
    distribute.mockResolvedValue({
      success: true,
      data: { cargo_id: 7, sent: 2, errors: ["AF: sin correo"] },
    });
    const outcome = await useCargoOffersStore().distribute(7, body);
    expect(outcome.failed).toEqual(["AF"]);
    expect(outcome.ok).toBe(false);
  });

  it("el API rechaza todo (400): ninguna enviada, todas pendientes y error visible con el motivo", async () => {
    distribute.mockRejectedValue(new Error("Failed to send RFQ to any carrier: KL: Carrier email not found for partner"));
    const outcome = await useCargoOffersStore().distribute(7, body);
    expect(outcome).toMatchObject({ ok: false, sent: 0, failed: ["KL", "AF", "LH"] });
    const toasts = useToastStore().items;
    expect(toasts.map((t) => t.kind)).toEqual(["error"]);
    expect(toasts[0].message).toContain("Carrier email not found for partner");
  });
});
