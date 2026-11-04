import { describe, expect, it } from "vitest";
// Ruta relativa, como en los demas specs que prueban codigo de packages/.
import { userError } from "../../../packages/platform/utils/apiError";
import { ApiError } from "../../../packages/shared-frontend/src/http/ApiError";

/** Traductor minimo: solo conoce las claves de `dict` e interpola {nombre}. */
function i18n(dict: Record<string, string>) {
  return {
    te: (k: string) => k in dict,
    t: (k: string, named?: Record<string, unknown>) =>
      (dict[k] ?? k).replace(/\{(\w+)\}/g, (_, n: string) => String(named?.[n] ?? "")),
  };
}

const dict = {
  "errors.api.COURIER_PACKAGE_OVERWEIGHT": "El bulto {package} supera el límite de {limit} {unit} por bulto de {courier}.",
  "errors.hint.COURIER_PACKAGE_OVERWEIGHT": "Divídelo en más bultos.",
  "errors.hint.COURIER_UNAVAILABLE": "Vuelve a intentarlo en unos minutos.",
  "errors.hint.category_internal": "Copia el detalle para soporte.",
};

/** Cuerpo que devuelve ahora el API para el envio 1001084313 (422). */
const overweightBody = {
  success: false,
  error: {
    code: "COURIER_PACKAGE_OVERWEIGHT",
    message: "FedEx: package 1 exceeds the 68 KG limit for its packaging.",
    details: {
      category: "courier_rejected",
      retryable: false,
      courier: "fedex",
      courier_code: "PACKAGINGTYPE.LIMIT.EXCEEDED",
      field: "WEIGHT_UNITS=KG",
      package: 1,
      limit: 68,
      unit: "KG",
      courier_message: "YOUR_PACKAGING cannot exceed the limit of 68.00 KG.for Package 1.",
    },
  },
  error_code: "COURIER_PACKAGE_OVERWEIGHT",
  message: "FedEx: package 1 exceeds the 68 KG limit for its packaging.",
};

describe("userError: un fallo del API listo para mostrarlo", () => {
  it("rechazo del courier (422): texto traducido con los datos, consejo y detalle para soporte", () => {
    const e = userError(new ApiError("x", 422, "COURIER_PACKAGE_OVERWEIGHT", overweightBody), i18n(dict));

    expect(e.code).toBe("COURIER_PACKAGE_OVERWEIGHT");
    expect(e.category).toBe("courier_rejected");
    expect(e.message).toBe("El bulto 1 supera el límite de 68 KG por bulto de FedEx.");
    expect(e.hint).toBe("Divídelo en más bultos.");
    expect(e.retryable).toBe(false);
    expect(e.technical).toContain("courier_code: PACKAGINGTYPE.LIMIT.EXCEEDED");
    expect(e.technical).toContain("http: 422");
  });

  it("respuesta 200 con success:false (contrato antiguo): se lee igual", () => {
    const e = userError(overweightBody, i18n(dict));
    expect(e.code).toBe("COURIER_PACKAGE_OVERWEIGHT");
    expect(e.message).toContain("FedEx");
  });

  it("sin traduccion para el codigo: el mensaje del servidor, nunca un objeto", () => {
    const body = { success: false, error: { code: "COURIER_REJECTED", message: "FedEx rejected the shipment: lane closed.", details: { category: "courier_rejected" } } };
    const e = userError(new ApiError("x", 422, undefined, body), i18n({}));
    expect(e.message).toBe("FedEx rejected the shipment: lane closed.");
    expect(e.hint).toBeNull();
  });

  it("courier sin respuesta (503): se puede reintentar", () => {
    const body = { success: false, error: { code: "COURIER_UNAVAILABLE", message: "FedEx did not answer in time.", details: { category: "courier_unavailable", retryable: true } } };
    const e = userError(new ApiError("x", 503, "SERVER_ERROR", body), i18n(dict));
    expect(e.retryable).toBe(true);
    expect(e.hint).toBe("Vuelve a intentarlo en unos minutos.");
  });

  it("500 sin categoria: interno, con el request_id para soporte", () => {
    const body = { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" }, request_id: "48e161a73e4730ea" };
    const e = userError(new ApiError("x", 500, "SERVER_ERROR", body), i18n(dict));
    expect(e.category).toBe("internal");
    expect(e.requestId).toBe("48e161a73e4730ea");
    expect(e.hint).toBe("Copia el detalle para soporte.");
    expect(e.technical).toContain("request_id: 48e161a73e4730ea");
  });

  it("error de red sin cuerpo: el texto de la excepcion", () => {
    const e = userError(new Error("Failed to fetch"), i18n({}), "Error");
    expect(e.message).toBe("Failed to fetch");
    expect(e.category).toBe("unknown");
  });
});
