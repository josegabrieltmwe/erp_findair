import { describe, expect, it } from "vitest";
import { bookingFailure } from "./booking.service";

/**
 * Los fallos de reserva/cancelación conservan el código de la API y la marca de
 * resultado desconocido. Antes todo salía como NETWORK_ERROR.
 */
const apiError = (status: number, payload: unknown, errorCode?: string) =>
  Object.assign(new Error("x"), { status, payload, errorCode });

describe("bookingFailure", () => {
  it("conserva el código de negocio de la API", () => {
    const r = bookingFailure(
      apiError(400, {
        success: false,
        error: { code: "QUOTE_EXPIRED", message: "Quote expired" },
        error_code: "QUOTE_EXPIRED",
      }),
      "BOOKING_TIMEOUT",
    );
    expect(r).toEqual({
      success: false,
      error: "Quote expired",
      error_code: "QUOTE_EXPIRED",
    });
  });

  it("409 de reconciliación", () => {
    const r = bookingFailure(
      apiError(409, {
        error: { code: "NEEDS_RECONCILIATION", message: "unknown" },
      }),
      "CANCEL_TIMEOUT",
    );
    expect(r.error_code).toBe("NEEDS_RECONCILIATION");
    expect(r.indeterminate).toBeUndefined();
  });

  it("504/502 o sin respuesta: resultado desconocido", () => {
    for (const status of [0, 502, 504]) {
      const r = bookingFailure(
        apiError(status, { title: "Servicio no disponible" }, "SERVER_ERROR"),
        "CANCEL_TIMEOUT",
      );
      expect(r.error_code).toBe("CANCEL_TIMEOUT");
      expect(r.indeterminate).toBe(true);
    }
  });

  it("500 sin código de negocio no se presenta como SERVER_ERROR", () => {
    const r = bookingFailure(
      apiError(500, {}, "SERVER_ERROR"),
      "BOOKING_TIMEOUT",
    );
    expect(r.error_code).toBe("BOOKING_FAILED");
  });
});
