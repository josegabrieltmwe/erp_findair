import { describe, expect, it } from "vitest";
import { cancelCargoState, canConfirmFlightAssign } from "./cargoGuards";
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

describe("cancelCargoState", () => {
  it("facturado bloquea", () => {
    expect(cancelCargoState({ id_fattura_a: "12" }, false).blocked).toBe(true);
    expect(cancelCargoState({ id_fattura_a2: "3" }, false).invoiced).toBe(true);
  });
  it("AWB y reserva avisan sin bloquear", () => {
    const s = cancelCargoState(
      { id_fattura_a: "0", AWB_forn: "176-1234" },
      true,
    );
    expect(s).toEqual({
      invoiced: false,
      hasAwb: true,
      hasActiveBooking: true,
      blocked: false,
    });
  });
  it("sin cargo no hay avisos", () => {
    expect(cancelCargoState(null, false)).toEqual({
      invoiced: false,
      hasAwb: false,
      hasActiveBooking: false,
      blocked: false,
    });
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
