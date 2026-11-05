import { describe, expect, it } from "vitest";
import { serverFieldErrors, validateAddress } from "./addressValidation";

const full = { name: "ACME", address: "Via Roma 1", country: "IT", city: "Milano", cap: "20100", prov: "MI" };

describe("validateAddress", () => {
  it("dirección completa → sin errores", () => {
    expect(validateAddress(full, { cap_enabled: "S", prov_enabled: "S" })).toEqual({});
  });

  it("exige nombre, dirección, país y ciudad", () => {
    expect(validateAddress({ address: [" "] }, null)).toEqual({
      name: "err_required",
      address: "err_required",
      country: "err_required",
      city: "err_required",
    });
  });

  it("CAP solo si el país lo usa; provincia solo si es obligatoria", () => {
    const a = { ...full, cap: "", prov: "" };
    expect(validateAddress(a, { cap_enabled: "S", prov_enabled: "S" })).toEqual({
      cap: "err_cap_required",
      prov: "err_prov_required",
    });
    expect(validateAddress(a, { cap_enabled: "N", prov_enabled: "F" })).toEqual({});
    // Sin datos del país no se exige nada más: lo valida el API.
    expect(validateAddress(a, null)).toEqual({});
  });
});

describe("serverFieldErrors", () => {
  it("lee details.fields como objeto {campo: mensaje}", () => {
    expect(
      serverFieldErrors({
        success: false,
        error_code: "VALIDATION_ERROR",
        details: { fields: { nome: "required", citta: ["required"], id_paese_iso: "invalid" } },
      }),
    ).toEqual({ name: "required", city: "required", country: "invalid" });
  });

  it("lee details.fields como lista de mensajes con el campo delante", () => {
    expect(
      serverFieldErrors({ details: { fields: ["cap required", "prov: missing", "otra cosa"] } }),
    ).toEqual({ cap: "cap required", prov: "prov: missing" });
  });

  it("sin campos → {}", () => {
    expect(serverFieldErrors({ success: false, error: "boom" })).toEqual({});
    expect(serverFieldErrors(undefined)).toEqual({});
  });
});
