import { describe, expect, it } from "vitest";
import { buildAccess } from "@shared/composables/useAccess";
import {
  authorizationStatusColor,
  availableAuthorizationActions,
  isAuthorizationSettled,
  methodIcon,
  methodLabelKey,
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

describe("methodLabelKey / methodIcon", () => {
  // Escenario (decisión 2026-11-26): el API ya no devuelve marca, últimos 4 ni caducidad; del medio solo se muestra el tipo.
  it("tarjeta y SEPA con su clave i18n e icono; un tipo desconocido cae en tarjeta", () => {
    expect(methodLabelKey("card")).toBe("payments.authorizations.method.card");
    expect(methodLabelKey("sepa_debit")).toBe("payments.authorizations.method.sepa_debit");
    expect(methodLabelKey("otro")).toBe("payments.authorizations.method.card");
    expect(methodIcon("sepa_debit")).toBe("mdi-bank-outline");
    expect(methodIcon("card")).toBe("mdi-credit-card-outline");
  });
});

describe("authorizationStatusColor", () => {
  it("colorea por estado y tolera estados nuevos", () => {
    expect(authorizationStatusColor("active")).toBe("success");
    expect(authorizationStatusColor("failed")).toBe("error");
    expect(authorizationStatusColor("nuevo")).toBe("default");
  });
});
