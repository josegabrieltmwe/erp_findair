import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@shared/anagrafiche/services/api.types";
import {
  classifyPostchargeError,
  forgetStandardCustomers,
  formatPostchargeAmount,
  isKnownStandardCustomer,
  postchargeBlock,
  postchargeStatusColor,
  rememberStandardCustomer,
  sumAmounts,
} from "./bookingPostchargeModel";

afterEach(() => forgetStandardCustomers());

describe("postchargeBlock", () => {
  // Escenario: mismas reglas que Booking_Postcharge_Service::start() (facturado, sin 2ª factura, importe > 0).
  it("pide primera factura, sin segunda y con importe", () => {
    expect(
      postchargeBlock({ invoiceId: "0", postInvoiceId: "0", postAmount: 13 }),
    ).toBe("not_invoiced");
    expect(postchargeBlock({ invoiceId: null, postAmount: 13 })).toBe(
      "not_invoiced",
    );
    expect(
      postchargeBlock({
        invoiceId: "120",
        postInvoiceId: "121",
        postAmount: 13,
      }),
    ).toBe("post_billed");
    expect(
      postchargeBlock({ invoiceId: "120", postInvoiceId: "0", postAmount: 0 }),
    ).toBe("no_amount");
    expect(
      postchargeBlock({ invoiceId: 120, postInvoiceId: "", postAmount: 13 }),
    ).toBeNull();
  });
});

describe("sumAmounts", () => {
  it("suma textos del API en céntimos, sin errores de coma flotante", () => {
    expect(sumAmounts("0.10", "0.20")).toBe(0.3);
    expect(sumAmounts("13.00", null, undefined, "abc")).toBe(13);
  });
});

describe("postchargeStatusColor", () => {
  it("colorea los estados y tolera uno nuevo", () => {
    expect(postchargeStatusColor("paid")).toBe("success");
    expect(postchargeStatusColor("awaiting_payment")).toBe("warning");
    expect(postchargeStatusColor("invoice_pending")).toBe("error");
    expect(postchargeStatusColor("nuevo")).toBe("default");
  });
});

describe("formatPostchargeAmount", () => {
  // Escenario: el importe llega como texto con punto; se muestra con el formato del idioma de la interfaz.
  it("usa el idioma de la interfaz", () => {
    expect(formatPostchargeAmount("23.79", "EUR", "de")).toBe(
      new Intl.NumberFormat("de", {
        style: "currency",
        currency: "EUR",
      }).format(23.79),
    );
    expect(formatPostchargeAmount("1234.5", "EUR", "en")).toBe("€1,234.50");
    expect(formatPostchargeAmount(null, "EUR", "es")).toBe("—");
    expect(formatPostchargeAmount("x", "EUR", "es")).toBe("—");
  });
});

describe("classifyPostchargeError", () => {
  const err = (status: number, code: string) =>
    new ApiError("x", status, "SERVER_ERROR", {
      code,
      error_code: code,
      error: { code },
    });

  it("mapea los códigos del contrato", () => {
    expect(classifyPostchargeError(err(409, "NOT_CARD_CUSTOMER"))).toBe(
      "not_card",
    );
    expect(classifyPostchargeError(err(409, "NOT_INVOICED"))).toBe(
      "not_invoiced",
    );
    expect(classifyPostchargeError(err(409, "ALREADY_POSTBILLED"))).toBe(
      "already_postbilled",
    );
    expect(classifyPostchargeError(err(422, "NO_POST_AMOUNT"))).toBe(
      "no_amount",
    );
    expect(classifyPostchargeError(err(422, "POSTCHARGE_PREVIEW_FAILED"))).toBe(
      "preview_failed",
    );
    expect(classifyPostchargeError(err(422, "PAYMENT_INVALID"))).toBe(
      "invalid",
    );
    expect(classifyPostchargeError(err(502, "POSTCHARGE_INVOICE_FAILED"))).toBe(
      "invoice_failed",
    );
  });

  it("sin code conocido cae en el genérico de su estado", () => {
    expect(classifyPostchargeError(new ApiError("x", 403, "FORBIDDEN"))).toBe(
      "forbidden",
    );
    expect(classifyPostchargeError(err(404, "PAYMENT_NOT_FOUND"))).toBe(
      "not_found",
    );
    expect(classifyPostchargeError(err(409, "OTRO"))).toBe("conflict");
    // Un 502 genérico del BFF (avería) no se confunde con la postfactura fallida.
    expect(
      classifyPostchargeError(new ApiError("x", 502, "upstream_error")),
    ).toBe("other");
    expect(classifyPostchargeError(new Error("red"))).toBe("other");
  });
});

describe("clientes que no pagan con tarjeta", () => {
  it("se recuerdan por cliente durante la sesión", () => {
    expect(isKnownStandardCustomer(77)).toBe(false);
    rememberStandardCustomer(77);
    rememberStandardCustomer(0);
    expect(isKnownStandardCustomer(77)).toBe(true);
    expect(isKnownStandardCustomer(0)).toBe(false);
    expect(isKnownStandardCustomer(null)).toBe(false);
  });
});
