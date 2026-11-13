import { describe, expect, it } from "vitest";
import { validateDraft } from "./cargoRules";

const t = (key: string, params?: Record<string, unknown>) =>
  params?.label ? `${key}|${params.label}` : key;

describe("validateDraft con claves i18n (H23)", () => {
  it("devuelve claves por campo, no texto italiano", () => {
    const e = validateDraft({ peso: -2, id_cliente: 1.5, id_valuta_assic: "X" } as never, undefined, t);
    expect(e.peso).toBe("cargo.validation.negative|cargo.validation.fields.peso");
    expect(e.id_cliente).toBe("cargo.validation.not_integer|cargo.validation.fields.id_cliente");
    expect(e.id_valuta_assic).toMatch(/^cargo\.validation\.currency_invalid/);
  });

  it("omite los campos bloqueados", () => {
    expect(validateDraft({ peso: -2 } as never, (f) => f === "peso", t)).toEqual({});
  });

  // Collaudo 13/11: colli=0.5, fechas imposibles y carico_extra negativo pasaban.
  it("colli entero, carico_extra >= 0 y data_sped1 real", () => {
    expect(validateDraft({ colli: 1.5 } as never, undefined, t).colli).toMatch(/not_integer/);
    expect(validateDraft({ carico_extra: -1 } as never, undefined, t).carico_extra).toMatch(/negative/);
    for (const bad of ["2026-02-30", "abc", "31/02/2026"]) {
      expect(validateDraft({ data_sped1: bad } as never, undefined, t).data_sped1).toMatch(/invalid_date/);
    }
    for (const ok of ["2026-11-14", "14/11/2026", ""]) {
      expect(validateDraft({ data_sped1: ok } as never, undefined, t)).toEqual({});
    }
  });
});
