import { describe, expect, it } from "vitest";
import { ApiError } from "@shared/anagrafiche/services/api.types";
import { buildAccess } from "@shared/composables/useAccess";
import {
  amountForRequest,
  canPayOnline,
  formatMinorAmount,
  classifyPayError,
  isCheckoutExpired,
  isSafeCheckoutUrl,
  isTerminalStatus,
  newIdempotencyKey,
  normalizeAmount,
  parsePayReturn,
  pollDelay,
  toMinor,
  validatePayAmount,
} from "./payOnlineModel";

describe("canPayOnline", () => {
  // Escenario: solo payment_gateways:write habilita cobrar; read o payments:write no bastan.
  it("exige payment_gateways:write", () => {
    const acc = (scopes: string[]) => buildAccess({ access: { scopes } });
    expect(canPayOnline(acc(["payment_gateways:write"]))).toBe(true);
    expect(canPayOnline(acc(["payment_gateways:read", "payments:read"]))).toBe(
      false,
    );
    expect(canPayOnline(buildAccess(null))).toBe(false);
  });
});

describe("normalizeAmount / toMinor", () => {
  // Escenario: coma o punto decimal se normalizan a texto con 2 decimales; formatos dudosos se rechazan.
  it("normaliza a texto decimal de 2 decimales", () => {
    expect(normalizeAmount("12,5")).toBe("12.50");
    expect(normalizeAmount(" 7 ")).toBe("7.00");
    expect(normalizeAmount(0.1)).toBe("0.10");
    expect(normalizeAmount("007.25")).toBe("7.25");
  });
  it("rechaza vacíos, negativos, notación científica y más de 2 decimales", () => {
    for (const bad of [
      "",
      "abc",
      "-1",
      "1e3",
      "1.234",
      "1.2.3",
      null,
      undefined,
    ]) {
      expect(normalizeAmount(bad as string)).toBeNull();
    }
  });
  it("convierte a céntimos sin errores de coma flotante", () => {
    expect(toMinor("19.99")).toBe(1999);
    expect(toMinor("0.30")).toBe(30);
    expect(toMinor("x")).toBeNull();
  });
});

describe("validatePayAmount", () => {
  // Escenario: importe parcial frente a una pendiente de 100,00.
  it("exige importe y formato válido", () => {
    expect(validatePayAmount("", 100)).toBe("required");
    expect(validatePayAmount("12.345", 100)).toBe("invalid");
  });
  it("rechaza cero y acepta hasta el total pendiente inclusive", () => {
    expect(validatePayAmount("0", 100)).toBe("not_positive");
    expect(validatePayAmount("100", 100)).toBeNull();
    expect(validatePayAmount("100,01", 100)).toBe("exceeds");
    expect(validatePayAmount("40,50", 100)).toBeNull();
  });
});

describe("amountForRequest", () => {
  // Escenario: el cobro total no manda importe; el parcial manda el texto normalizado.
  it("omite el importe cuando es todo lo pendiente", () => {
    expect(amountForRequest("full", "", 100)).toBeUndefined();
    expect(amountForRequest("partial", "100,00", 100)).toBeUndefined();
  });
  it("envía el parcial normalizado", () => {
    expect(amountForRequest("partial", "40,5", 100)).toBe("40.50");
  });
});

describe("newIdempotencyKey", () => {
  // Escenario: cada intento recibe una clave distinta y con prefijo reconocible.
  it("genera claves únicas con prefijo", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^erp-pay-/);
    expect(a).not.toBe(b);
  });
});

describe("classifyPayError", () => {
  // Escenario: cada estado del contrato de api_pay_payments se agrupa en su clase.
  it("agrupa 402, 409 y 422 por estado", () => {
    expect(
      classifyPayError(new ApiError("x", 402, "PAYMENT_DECLINED")).kind,
    ).toBe("declined");
    expect(
      classifyPayError(new ApiError("x", 409, "IDEMPOTENCY_KEY_REUSED")).kind,
    ).toBe("conflict");
    expect(
      classifyPayError(new ApiError("x", 422, "VALIDATION_ERROR")).kind,
    ).toBe("invalid");
  });
  // Escenario: en 503 http() pone code SERVER_ERROR; el código real va en el cuerpo (error_code o error.code).
  it("detecta PAYMENT_GATEWAYS_NOT_ACTIVE en el cuerpo del 503", () => {
    const a = new ApiError("x", 503, "SERVER_ERROR", {
      error_code: "PAYMENT_GATEWAYS_NOT_ACTIVE",
    });
    const b = new ApiError("x", 503, "SERVER_ERROR", {
      error: { code: "PAYMENT_GATEWAYS_NOT_ACTIVE" },
    });
    expect(classifyPayError(a)).toEqual({
      kind: "not_active",
      code: "PAYMENT_GATEWAYS_NOT_ACTIVE",
    });
    expect(classifyPayError(b).kind).toBe("not_active");
  });
  it("un 503 con otro código o un error ajeno es other", () => {
    expect(
      classifyPayError(
        new ApiError("x", 503, "SERVER_ERROR", { error_code: "OTRO" }),
      ).kind,
    ).toBe("other");
    expect(classifyPayError(new Error("boom")).kind).toBe("other");
  });
});

describe("estado y sondeo", () => {
  // Escenario: succeeded/failed/canceled/expired cierran el sondeo; processing y desconocidos lo mantienen.
  it("reconoce estados terminales", () => {
    for (const s of ["succeeded", "failed", "canceled", "expired"])
      expect(isTerminalStatus(s)).toBe(true);
    for (const s of ["pending", "processing", "nuevo", null, undefined])
      expect(isTerminalStatus(s as string)).toBe(false);
  });
  it("espacia el sondeo tras los primeros intentos", () => {
    expect(pollDelay(0)).toBe(3000);
    expect(pollDelay(10)).toBe(8000);
  });
  it("detecta la caducidad de la sesión", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(isCheckoutExpired("2026-11-05T11:59:59Z", now)).toBe(true);
    expect(isCheckoutExpired("2026-11-05T12:30:00Z", now)).toBe(false);
    expect(isCheckoutExpired(null, now)).toBe(false);
  });
});

describe("isSafeCheckoutUrl", () => {
  // Escenario: solo se navega a URLs https.
  it("acepta https y rechaza otros esquemas o basura", () => {
    expect(
      isSafeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_1"),
    ).toBe(true);
    expect(isSafeCheckoutUrl("http://x.test")).toBe(false);
    expect(isSafeCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCheckoutUrl("no es url")).toBe(false);
    expect(isSafeCheckoutUrl(null)).toBe(false);
  });
});

describe("parsePayReturn", () => {
  // Escenario: Stripe devuelve a /payments/return?payment_id=pay_…&pay_result=success.
  it("lee el id y el resultado de la URL de retorno", () => {
    expect(
      parsePayReturn({ payment_id: "pay_abc123", pay_result: "success" }),
    ).toEqual({
      paymentId: "pay_abc123",
      result: "success",
    });
    expect(
      parsePayReturn({ payment_id: "pay_abc123", pay_result: "cancel" }).result,
    ).toBe("cancel");
  });

  // Escenario: la URL la puede editar cualquiera; un id mal formado no llega a la consulta.
  it("descarta un id sin forma de pay_… y un resultado desconocido", () => {
    expect(parsePayReturn({ payment_id: "../etc", pay_result: "ok" })).toEqual({
      paymentId: null,
      result: null,
    });
    expect(parsePayReturn({ payment_id: "123" }).paymentId).toBeNull();
    expect(parsePayReturn({ payment_id: "pay_" }).paymentId).toBeNull();
    expect(parsePayReturn({}).paymentId).toBeNull();
    expect(parsePayReturn(null)).toEqual({ paymentId: null, result: null });
  });

  // Escenario: vue-router entrega un array si el parámetro se repite; se toma el primero.
  it("acepta parámetros repetidos tomando el primero", () => {
    expect(
      parsePayReturn({
        payment_id: ["pay_x1", "pay_y2"],
        pay_result: ["cancel"],
      }),
    ).toEqual({
      paymentId: "pay_x1",
      result: "cancel",
    });
  });
});

describe("formatMinorAmount", () => {
  // Escenario: 12550 céntimos en EUR se muestran con el formato del idioma activo.
  it("formatea céntimos con divisa y idioma", () => {
    expect(formatMinorAmount(12550, "EUR", "es")).toContain("125,50");
    expect(formatMinorAmount(12550, "EUR", "en")).toContain("125.50");
  });

  it("devuelve null sin importe y no falla con una divisa inválida", () => {
    expect(formatMinorAmount(null, "EUR", "es")).toBeNull();
    expect(formatMinorAmount(undefined, "EUR", "es")).toBeNull();
    expect(formatMinorAmount(1000, "no-es-divisa", "en")).toContain("10.00");
  });
});
