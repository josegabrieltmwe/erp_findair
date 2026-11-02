import { describe, expect, it } from "vitest";
import {
  cancelBlockDetail,
  cancelBlockFromServer,
  cancelCargoState,
  canConfirmFlightAssign,
  canSubmitCancel,
} from "./cargoGuards";
import { hasNewRowWithoutWeight } from "./packagesValidation";

describe("canConfirmFlightAssign", () => {
  const base = {
    confirmCheckbox: true,
    hasActiveBooking: false,
    cancelAck: false,
    busy: false,
  };
  it("sin reserva basta la casilla de tarifa", () => {
    expect(canConfirmFlightAssign(base)).toBe(true);
    expect(canConfirmFlightAssign({ ...base, confirmCheckbox: false })).toBe(
      false,
    );
  });
  it("con reserva viva exige la casilla de cancelación", () => {
    expect(canConfirmFlightAssign({ ...base, hasActiveBooking: true })).toBe(
      false,
    );
    expect(
      canConfirmFlightAssign({
        ...base,
        hasActiveBooking: true,
        cancelAck: true,
      }),
    ).toBe(true);
  });
  it("ocupado deshabilita", () => {
    expect(canConfirmFlightAssign({ ...base, busy: true })).toBe(false);
  });
});

describe("cancelCargoState (P43)", () => {
  it("facturado (cliente o proveedor) bloquea", () => {
    expect(cancelCargoState({ id_fattura_a: "12" }, false).blocked).toBe(true);
    expect(cancelCargoState({ id_fattura_p: "3" }, false).invoiced).toBe(true);
    expect(cancelCargoState({ id_fattura_a: "0", id_fattura_p: "0" }, false).invoiced).toBe(false);
  });
  it("reserva viva bloquea", () => {
    const s = cancelCargoState({}, true);
    expect(s.hasActiveBooking).toBe(true);
    expect(s.blocked).toBe(true);
    expect(s.needsForce).toBe(false);
  });
  it("AWB avisa sin bloquear; pide forzar solo a quien puede", () => {
    const base = { id_fattura_a: "0", AWB_forn: "176-1234" };
    expect(cancelCargoState(base, false, false)).toEqual({
      invoiced: false,
      hasAwb: true,
      hasActiveBooking: false,
      blocked: false,
      needsForce: false,
    });
    expect(cancelCargoState(base, false, true).needsForce).toBe(true);
  });
  it("con AWB y reserva viva no se ofrece forzar (la reserva no se fuerza)", () => {
    expect(cancelCargoState({ AWB_forn: "176-1" }, true, true).needsForce).toBe(false);
  });
  it("sin cargo no hay avisos", () => {
    expect(cancelCargoState(null, false)).toEqual({
      invoiced: false,
      hasAwb: false,
      hasActiveBooking: false,
      blocked: false,
      needsForce: false,
    });
  });
});

describe("cancelBlockFromServer", () => {
  it("facturado y reserva viva bloquean siempre", () => {
    expect(cancelBlockFromServer("CARGO_INVOICED", true)).toBe("blocked");
    expect(cancelBlockFromServer("CARGO_HAS_ACTIVE_BOOKING", true)).toBe("blocked");
  });
  it("AWB: forzar solo para quien puede", () => {
    expect(cancelBlockFromServer("CARGO_HAS_AWB", true)).toBe("needs_force");
    expect(cancelBlockFromServer("CARGO_HAS_AWB", false)).toBe("blocked");
  });
  it("otros errores no son un bloqueo de negocio", () => {
    expect(cancelBlockFromServer("PERSIST_ERROR", true)).toBe("error");
    expect(cancelBlockFromServer(null, true)).toBe("error");
  });
});

describe("canSubmitCancel", () => {
  const ok = { hasCargoId: true, blocked: false, needsForce: false, forceAck: false, loading: false };
  it("libre se puede cancelar", () => expect(canSubmitCancel(ok)).toBe(true));
  it("bloqueado, sin id o cargando no", () => {
    expect(canSubmitCancel({ ...ok, blocked: true })).toBe(false);
    expect(canSubmitCancel({ ...ok, hasCargoId: false })).toBe(false);
    expect(canSubmitCancel({ ...ok, loading: true })).toBe(false);
  });
  it("forzar exige la confirmación explícita", () => {
    expect(canSubmitCancel({ ...ok, needsForce: true })).toBe(false);
    expect(canSubmitCancel({ ...ok, needsForce: true, forceAck: true })).toBe(true);
  });
});

describe("cancelBlockDetail", () => {
  it("AWB, reserva y facturas", () => {
    expect(cancelBlockDetail("CARGO_HAS_AWB", { awb: "176-1" })).toEqual({
      key: "cargo.cancelmodal.detail_awb",
      params: { awb: "176-1" },
    });
    expect(
      cancelBlockDetail("CARGO_HAS_ACTIVE_BOOKING", { carrier: "klm", booking_id: "B9" })?.params,
    ).toEqual({ carrier: "KLM", id: "B9" });
    expect(
      cancelBlockDetail("CARGO_INVOICED", { id_fattura_a: 12, id_fattura_p: null })?.params,
    ).toEqual({ ids: "12" });
  });
  it("sin datos útiles, nada", () => {
    expect(cancelBlockDetail("CARGO_INVOICED", { id_fattura_a: 0 })).toBeNull();
    expect(cancelBlockDetail("OTRO", { awb: "x" })).toBeNull();
  });
});

describe("hasNewRowWithoutWeight", () => {
  const existing = (r: { id?: number; peso?: unknown }) => r.id === 1;
  it("detecta nuevas con peso 0", () => {
    expect(hasNewRowWithoutWeight([{ peso: "0" }], existing)).toBe(true);
    expect(hasNewRowWithoutWeight([{ peso: "2.5" }], existing)).toBe(false);
  });
  it("ignora las filas ya existentes", () => {
    expect(hasNewRowWithoutWeight([{ id: 1, peso: "0" }], existing)).toBe(
      false,
    );
  });
});
