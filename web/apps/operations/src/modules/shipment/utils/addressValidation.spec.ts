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

  // Collaudo 13/11: «telefonoABC» y «abc@» se guardaban tal cual.
  it("teléfono y email: opcionales, pero con forma válida si se rellenan", () => {
    expect(validateAddress({ ...full, tel: "", email: "" }, null)).toEqual({});
    expect(validateAddress({ ...full, tel: "+39 02 1234-567", email: "a@b.it" }, null)).toEqual({});
    expect(validateAddress({ ...full, tel: "telefonoABC" }, null)).toEqual({ tel: "err_phone_invalid" });
    expect(validateAddress({ ...full, tel: "123" }, null)).toEqual({ tel: "err_phone_invalid" });
    expect(validateAddress({ ...full, email: "abc@" }, null)).toEqual({ email: "err_email_invalid" });
    expect(validateAddress({ ...full, email: "a b@c.it" }, null)).toEqual({ email: "err_email_invalid" });
  });
});
