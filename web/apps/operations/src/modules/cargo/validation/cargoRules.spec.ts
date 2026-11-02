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
});
