import { describe, expect, it } from "vitest";
import {
  actionLeavesQueue,
  shipmentBulkActionsFor,
} from "./shipment-work-views";

describe("acciones por lote según la cola (paridad con bulkOptionsFor del legado)", () => {
  it("IN: controlar primero, salida y archivar", () => {
    expect(shipmentBulkActionsFor("dacontr").slice(0, 3)).toEqual([
      "control",
      "depart",
      "archive",
    ]);
  });

  it("una oferta no se «controla» ni se marca salida en bloque", () => {
    expect(shipmentBulkActionsFor("offert")).toEqual(["archive"]);
  });

  it("recogida del fornitore: los cinco estados de presa", () => {
    const a = shipmentBulkActionsFor("presefornN");
    for (const x of [
      "pickup_send",
      "pickup_confirm",
      "pickup_picked",
      "pickup_failed",
      "pickup_reset",
    ] as const) {
      expect(a).toContain(x);
    }
    expect(a).not.toContain("control");
  });

  it("recogida interna abre con controlar y además ofrece los estados", () => {
    expect(shipmentBulkActionsFor("preseint")[0]).toBe("control");
    expect(shipmentBulkActionsFor("preseint")).toContain("pickup_send");
  });

  it("COD: cobrado, transferencia y anulado", () => {
    expect(shipmentBulkActionsFor("codcliprnt").slice(0, 3)).toEqual([
      "cod_collected",
      "cod_bank",
      "cod_annul",
    ]);
  });

  it("salidas y en viaje", () => {
    expect(shipmentBulkActionsFor("contrnopart")[0]).toBe("depart");
    expect(shipmentBulkActionsFor("indelay").slice(0, 2)).toEqual([
      "transit",
      "deliver",
    ]);
  });

  it("toda cola ofrece al menos una acción y nunca repite", () => {
    for (const t of ["all", "dacontr", "offert", "presefornW", "codcliprnt", "indelay", "contrnopart", "zzz"]) {
      const a = shipmentBulkActionsFor(t);
      expect(a.length).toBeGreaterThan(0);
      expect(new Set(a).size).toBe(a.length);
    }
  });

  it("qué acciones sacan el registro de la cola (feedback inmediato)", () => {
    expect(actionLeavesQueue("dacontr", "control")).toBe(true);
    expect(actionLeavesQueue("all", "control")).toBe(false);
    expect(actionLeavesQueue("contrnopart", "depart")).toBe(true);
    expect(actionLeavesQueue("presefornN", "pickup_send")).toBe(true);
    expect(actionLeavesQueue("presefornW", "pickup_send")).toBe(false);
    expect(actionLeavesQueue("indelay", "deliver")).toBe(false);
  });
});
