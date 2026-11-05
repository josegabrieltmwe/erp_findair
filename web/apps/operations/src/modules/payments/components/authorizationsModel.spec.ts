import { describe, expect, it } from "vitest";
import { buildAccess } from "@shared/composables/useAccess";
import {
  authorizationStatusColor,
  availableAuthorizationActions,
  describeMethod,
  isAuthorizationSettled,
  newAuthorizationKey,
} from "./authorizationsModel";

const acc = (scopes: string[]) => buildAccess({ access: { scopes } });

describe("newAuthorizationKey", () => {
  // Escenario: la clave cumple el formato del API (8-64 caracteres A-Za-z0-9_-:) y no se repite.
  it("cumple el formato del API y es distinta en cada llamada", () => {
    const a = newAuthorizationKey();
    expect(a).toMatch(/^[A-Za-z0-9_\-:]{8,64}$/);
    expect(newAuthorizationKey()).not.toBe(a);
  });
});

describe("isAuthorizationSettled", () => {
  it("pending sigue en curso; el resto es definitivo", () => {
    expect(isAuthorizationSettled("pending")).toBe(false);
    for (const s of ["active", "failed", "revoked", "expired"]) expect(isAuthorizationSettled(s)).toBe(true);
    expect(isAuthorizationSettled(null)).toBe(false);
  });
});

describe("availableAuthorizationActions", () => {
  // Escenario: revocar exige :write y una autorización pending/active; sin el scope no hay botón.
  it("revocar solo con write y estado vigente", () => {
    const write = acc(["payment_gateways:read", "payment_gateways:write"]);
    expect(availableAuthorizationActions({ status: "active" }, write)).toEqual(["revoke"]);
    expect(availableAuthorizationActions({ status: "pending" }, write)).toEqual(["revoke"]);
    expect(availableAuthorizationActions({ status: "revoked" }, write)).toEqual([]);
    expect(availableAuthorizationActions({ status: "expired" }, write)).toEqual([]);
    expect(availableAuthorizationActions({ status: "active" }, acc(["payment_gateways:read"]))).toEqual([]);
  });
});

describe("describeMethod", () => {
  // Escenario: solo marca, últimos 4 y caducidad; sin últimos 4 aún no hay medio guardado.
  it("formatea tarjeta, SEPA y pendiente", () => {
    expect(describeMethod({ method_type: "card", brand: "visa", last4: "4242", exp_month: 3, exp_year: 2028 })).toBe("VISA ····4242 (03/2028)");
    expect(describeMethod({ method_type: "sepa_debit", brand: null, last4: "1234", exp_month: null, exp_year: null })).toBe("SEPA ····1234");
    expect(describeMethod({ method_type: "card", brand: null, last4: null, exp_month: null, exp_year: null })).toBe("—");
    // Sin marca se usa la etiqueta traducida que pasa la pantalla (no un texto español fijo).
    expect(describeMethod({ method_type: "card", brand: null, last4: "0001", exp_month: 3, exp_year: 2027 }, "Card")).toBe("Card ····0001 (03/2027)");
    expect(describeMethod({ method_type: "card", brand: null, last4: "0001", exp_month: null, exp_year: null }, "Carta")).toBe("Carta ····0001");
  });
});

describe("authorizationStatusColor", () => {
  it("colorea por estado y tolera estados nuevos", () => {
    expect(authorizationStatusColor("active")).toBe("success");
    expect(authorizationStatusColor("failed")).toBe("error");
    expect(authorizationStatusColor("nuevo")).toBe("default");
  });
});
