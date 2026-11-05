import { describe, expect, it } from "vitest";
import { normalizeFromCargoResponse } from "./linked_express.service";

describe("normalizeFromCargoResponse", () => {
  it("lee el id de data.shipment_id (forma actual del API)", () => {
    const r = normalizeFromCargoResponse({
      success: true,
      data: { shipment_id: 4321, cargo_id: 9 },
      message: "Spedizione creata da cargo",
    });
    expect(r).toEqual({ success: true, shipment_id: 4321 });
  });

  it("acepta el id en la raíz (forma antigua) y como string", () => {
    expect(normalizeFromCargoResponse({ success: true, shipment_id: "77" })).toEqual({
      success: true,
      shipment_id: 77,
    });
  });

  it("success del API sin id → fallo", () => {
    const r = normalizeFromCargoResponse({ success: true, data: {} });
    expect(r.success).toBe(false);
    expect(r.shipment_id).toBe(0);
  });

  it("success false con id → fallo y conserva el error", () => {
    const r = normalizeFromCargoResponse({
      success: false,
      data: { shipment_id: 5 },
      error: "cargo_locked",
    });
    expect(r.success).toBe(false);
    expect(r.error).toBe("cargo_locked");
  });

  it("respuesta vacía o id no numérico → fallo", () => {
    expect(normalizeFromCargoResponse(null).success).toBe(false);
    expect(normalizeFromCargoResponse({ success: true, data: { shipment_id: "abc" } }))
      .toMatchObject({ success: false, shipment_id: 0 });
  });
});
