import { describe, expect, it } from "vitest";
import { buildAccess } from "@shared/composables/useAccess";
import { ApiError } from "@shared/anagrafiche/services/api.types";
import {
  availableActions,
  canAdminSurcharges,
  canViewSurcharges,
  canWriteSurcharges,
  chargeResultKey,
  classifySurchargeError,
  eurosToMinor,
  formatMinor,
  isDisputeWindowOpen,
  isNoticeElapsed,
  needsSettlement,
  pageCount,
  parseApiDate,
  statusColor,
  validateProposal,
  type ProposeForm,
} from "./surchargesModel";

const acc = (scopes: string[]) => buildAccess({ access: { scopes } });
const NOW = Date.parse("2026-11-10T12:00:00Z");
const PAST = "2026-11-01 10:00:00";
const FUTURE = "2026-11-20 10:00:00";

describe("permisos de UX", () => {
  // Escenario: cada nivel exige su scope; el de lectura no concede escritura ni administración.
  it("read, write y admin son independientes", () => {
    expect(canViewSurcharges(acc(["payment_gateways:read"]))).toBe(true);
    expect(canWriteSurcharges(acc(["payment_gateways:read"]))).toBe(false);
    expect(canAdminSurcharges(acc(["payment_gateways:read", "payment_gateways:write"]))).toBe(false);
    expect(canAdminSurcharges(acc(["payment_gateways:admin"]))).toBe(true);
    expect(canViewSurcharges(buildAccess(null))).toBe(false);
  });
});

describe("fechas y plazos", () => {
  it("parsea fechas con espacio o ISO y rechaza basura", () => {
    expect(parseApiDate("2026-11-01 10:00:00")).not.toBeNull();
    expect(parseApiDate("2026-11-01T10:00:00Z")).not.toBeNull();
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate("ayer")).toBeNull();
  });
  it("preaviso vencido solo con fecha pasada; impugnación abierta solo con fecha futura", () => {
    expect(isNoticeElapsed({ notice_due_at: PAST }, NOW)).toBe(true);
    expect(isNoticeElapsed({ notice_due_at: FUTURE }, NOW)).toBe(false);
    expect(isNoticeElapsed({ notice_due_at: null }, NOW)).toBe(false);
    expect(isDisputeWindowOpen({ dispute_until: FUTURE }, NOW)).toBe(true);
    expect(isDisputeWindowOpen({ dispute_until: PAST }, NOW)).toBe(false);
    expect(isDisputeWindowOpen({ dispute_until: null }, NOW)).toBe(false);
  });
});

describe("availableActions", () => {
  const read = acc(["payment_gateways:read"]);
  const write = acc(["payment_gateways:read", "payment_gateways:write"]);
  const admin = acc(["payment_gateways:read", "payment_gateways:write", "payment_gateways:admin"]);
  const row = (status: string, notice = PAST, dispute = FUTURE) =>
    ({ status, notice_due_at: notice, dispute_until: dispute }) as Parameters<typeof availableActions>[0];

  // Escenario: sin scope de escritura ni de administrador no se ofrece ninguna acción (los botones no se pintan).
  it("solo lectura: ninguna acción", () => {
    for (const s of ["pending_notice", "notified", "charged", "failed", "disputed"]) {
      expect(availableActions(row(s), read, NOW)).toEqual([]);
    }
  });

  // Escenario: con :write se puede avisar y impugnar en nombre del cliente, pero nunca perdonar, rechazar ni cobrar.
  it("write: avisar un propuesto e impugnar uno avisado o cobrado dentro de plazo", () => {
    expect(availableActions(row("pending_notice"), write, NOW)).toEqual(["notify"]);
    expect(availableActions(row("notified"), write, NOW)).toEqual(["dispute"]);
    expect(availableActions(row("charged"), write, NOW)).toEqual(["dispute"]);
    expect(availableActions(row("notified", PAST, PAST), write, NOW)).toEqual([]);
    expect(availableActions(row("disputed"), write, NOW)).toEqual([]);
  });

  // Escenario: las acciones de administrador exigen payment_gateways:admin y respetan el estado.
  it("admin: perdonar casi siempre, rechazar solo impugnados, cobrar con preaviso vencido", () => {
    expect(availableActions(row("pending_notice"), admin, NOW)).toEqual(["notify", "waive"]);
    expect(availableActions(row("notified"), admin, NOW)).toEqual(["dispute", "waive", "charge"]);
    expect(availableActions(row("notified", FUTURE), admin, NOW)).toEqual(["dispute", "waive"]);
    expect(availableActions(row("failed"), admin, NOW)).toEqual(["waive", "charge"]);
    expect(availableActions(row("disputed"), admin, NOW)).toEqual(["waive", "reject_dispute"]);
    expect(availableActions(row("charged"), admin, NOW)).toEqual(["dispute", "waive"]);
  });

  it("perdonados y facturados no admiten acciones de administrador", () => {
    expect(availableActions(row("waived"), admin, NOW)).toEqual([]);
    expect(availableActions(row("invoiced"), admin, NOW)).toEqual([]);
  });

  // Escenario: solo admin sin write (combinación rara): ofrece las de administrador pero no avisar/impugnar.
  it("admin sin write no ofrece avisar ni impugnar", () => {
    expect(availableActions(row("notified"), acc(["payment_gateways:admin"]), NOW)).toEqual(["waive", "charge"]);
  });
});

describe("importes", () => {
  // Escenario: euros escritos -> céntimos enteros sin coma flotante.
  it("eurosToMinor convierte con coma o punto y rechaza lo mal formado", () => {
    expect(eurosToMinor("42,50")).toBe(4250);
    expect(eurosToMinor("42.5")).toBe(4250);
    expect(eurosToMinor("42")).toBe(4200);
    expect(eurosToMinor("0,07")).toBe(7);
    expect(eurosToMinor("19.99")).toBe(1999);
    expect(eurosToMinor("1,234")).toBeNull();
    expect(eurosToMinor("abc")).toBeNull();
    expect(eurosToMinor("-5")).toBeNull();
    expect(eurosToMinor("")).toBeNull();
  });
  it("formatMinor muestra céntimos como euros con divisa", () => {
    expect(formatMinor(4200)).toMatch(/^42,00 EUR$/);
    expect(formatMinor(5)).toMatch(/^0,05 EUR$/);
    expect(formatMinor(null)).toMatch(/^0,00 EUR$/);
  });
});

describe("validateProposal", () => {
  const ok: ProposeForm = { customerId: 4521, type: "overweight", amount: "42,50", declared: "10", measured: "14", evidence: "acta", carrierRef: "" };
  it("un formulario completo es válido", () => {
    expect(validateProposal(ok)).toEqual([]);
  });
  it("sobrepeso y oversize exigen valor declarado y medido; other no", () => {
    expect(validateProposal({ ...ok, declared: "", measured: "" })).toEqual(["declared", "measured"]);
    expect(validateProposal({ ...ok, type: "oversize", declared: " " })).toEqual(["declared"]);
    expect(validateProposal({ ...ok, type: "other", declared: "", measured: "" })).toEqual([]);
  });
  it("exige cliente, importe positivo y evidencia", () => {
    expect(validateProposal({ ...ok, customerId: null })).toEqual(["customer"]);
    expect(validateProposal({ ...ok, amount: "0" })).toEqual(["amount"]);
    expect(validateProposal({ ...ok, amount: "1,234" })).toEqual(["amount"]);
    expect(validateProposal({ ...ok, evidence: "  " })).toEqual(["evidence"]);
  });
});

describe("classifySurchargeError", () => {
  const err = (status: number, code?: string) => new ApiError("x", status, code);
  // Escenario: cada código del contrato produce el tipo de mensaje esperado.
  it("clasifica por estado y código", () => {
    expect(classifySurchargeError(err(503, "PAYMENT_NOT_ACTIVE"))).toBe("not_active");
    expect(classifySurchargeError(err(503, "PAYMENT_RETURN_URL_NOT_CONFIGURED"))).toBe("return_url");
    expect(classifySurchargeError(err(503, "OTRO"))).toBe("other");
    expect(classifySurchargeError(err(403, "PAYMENT_FORBIDDEN"))).toBe("forbidden");
    expect(classifySurchargeError(err(404, "PAYMENT_NOT_FOUND"))).toBe("not_found");
    expect(classifySurchargeError(err(422, "SURCHARGE_CAP_EXCEEDED"))).toBe("cap_exceeded");
    expect(classifySurchargeError(err(422, "PAYMENT_UNSUPPORTED_CURRENCY"))).toBe("currency");
    expect(classifySurchargeError(err(422, "PAYMENT_INVALID"))).toBe("invalid");
    expect(classifySurchargeError(err(409, "SURCHARGE_NOTICE_NOT_ELAPSED"))).toBe("notice_not_elapsed");
    expect(classifySurchargeError(err(409, "SURCHARGE_DISPUTE_WINDOW_CLOSED"))).toBe("dispute_closed");
    expect(classifySurchargeError(err(409, "SURCHARGE_PAYMENT_IN_FLIGHT"))).toBe("in_flight");
    expect(classifySurchargeError(err(409, "PAYMENT_INVALID_STATE"))).toBe("invalid_state");
    expect(classifySurchargeError(err(409, "AUTHORIZATION_ALREADY_ACTIVE"))).toBe("authorization_exists");
    expect(classifySurchargeError(err(409, "CONSENT_TEXT_NOT_CURRENT"))).toBe("consent_stale");
    expect(classifySurchargeError(err(409, "PAYMENT_METHOD_NOT_AVAILABLE"))).toBe("method_unavailable");
    expect(classifySurchargeError(err(409, "PAYMENT_IDEMPOTENCY_CONFLICT"))).toBe("conflict");
    expect(classifySurchargeError(err(500))).toBe("other");
    expect(classifySurchargeError(new Error("red"))).toBe("other");
  });
  // Escenario: el BFF devuelve el code en el cuerpo problem+json (details) y no en ApiError.code.
  it("lee el code del cuerpo cuando ApiError.code no viene", () => {
    expect(classifySurchargeError(new ApiError("x", 503, undefined, { error_code: "PAYMENT_NOT_ACTIVE" }))).toBe("not_active");
  });
});

describe("utilidades", () => {
  it("chargeResultKey acota a claves conocidas", () => {
    expect(chargeResultKey("charged")).toBe("charged");
    expect(chargeResultKey("requires_invoice")).toBe("requires_invoice");
    expect(chargeResultKey("lo-que-sea")).toBe("unknown");
    expect(chargeResultKey(undefined)).toBe("unknown");
  });
  it("statusColor y pageCount", () => {
    expect(statusColor("charged")).toBe("success");
    expect(statusColor("disputed")).toBe("warning");
    expect(statusColor("estado-nuevo")).toBe("default");
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(51, 25)).toBe(3);
  });
  it("needsSettlement acepta 1, true y '1' y se apaga con settled_at", () => {
    expect(needsSettlement({ settlement_required: 1, settled_at: null })).toBe(true);
    expect(needsSettlement({ settlement_required: true, settled_at: null })).toBe(true);
    expect(needsSettlement({ settlement_required: 1, settled_at: "2026-11-02" })).toBe(false);
    expect(needsSettlement({ settlement_required: 0, settled_at: null })).toBe(false);
    expect(needsSettlement({ settled_at: null })).toBe(false);
  });
});
