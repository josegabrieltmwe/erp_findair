import { describe, expect, it } from "vitest";
import {
  actionAvailable,
  blockingWarnings,
  errorI18nKey,
  normalizeApiError,
  shortDate,
  stateColor,
} from "./logic";

describe("normalizeApiError", () => {
  it("lee el cuerpo del API desde ApiError.details (VALIDATION_ERROR con campos)", () => {
    const e = normalizeApiError({
      message: "Request failed",
      status: 400,
      details: {
        success: false,
        error: "titolo: obbligatorio",
        code: "VALIDATION_ERROR",
        details: { fields: { "spedizione.peso": "deve essere > 0" } },
      },
    });
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.status).toBe(400);
    expect(e.fields["spedizione.peso"]).toBe("deve essere > 0");
  });

  it("conversion_blocked trae los avisos", () => {
    const avisos = [
      {
        codice: "NO_SHIPMENTS",
        severita: "error",
        id_prog_sped: null,
        messaggio: "x",
        ignorato: false,
      },
    ];
    const e = normalizeApiError({
      status: 409,
      details: { error: "no", code: "conversion_blocked", details: { avisos } },
    });
    expect(e.code).toBe("conversion_blocked");
    expect(e.avisos).toHaveLength(1);
  });

  it("invalid_state trae los estados admitidos", () => {
    const e = normalizeApiError({
      status: 409,
      details: {
        error: "x",
        code: "invalid_state",
        details: { stato: "A", ammessi: ["P"] },
      },
    });
    expect(e.allowedStates).toEqual(["P"]);
  });

  it("acepta un cuerpo {success:false} directo y entradas inválidas", () => {
    expect(
      normalizeApiError({ success: false, error: "m", code: "ACCESS_DENIED" })
        .code,
    ).toBe("ACCESS_DENIED");
    expect(normalizeApiError(null).code).toBe("UNKNOWN");
    expect(normalizeApiError(undefined).code).toBe("UNKNOWN");
  });
});

describe("helpers de presentación", () => {
  it("errorI18nKey cae en UNKNOWN para códigos no listados", () => {
    expect(errorI18nKey("already_assigned")).toBe(
      "consolidata.errors.already_assigned",
    );
    expect(errorI18nKey("zzz")).toBe("consolidata.errors.UNKNOWN");
  });

  it("stateColor", () => {
    expect(stateColor("P")).toBe("warning");
    expect(stateColor("?")).toBe("default");
  });

  it("actionAvailable lo decide el catálogo del API", () => {
    const actions = { close: { from: ["A", "P"] }, take: { from: null } };
    expect(actionAvailable(actions, "close", "P")).toBe(true);
    expect(actionAvailable(actions, "close", "C")).toBe(false);
    expect(actionAvailable(actions, "take", "C")).toBe(true);
    expect(actionAvailable(actions, "nope", "A")).toBe(false);
    expect(actionAvailable(null, "close", "A")).toBe(false);
  });

  it("blockingWarnings ignora los avisos ya ignorados y cuenta tarifa vencida", () => {
    const w = (
      codice: string,
      severita: "error" | "warn",
      ignorato = false,
    ) => ({ codice, severita, id_prog_sped: null, messaggio: "", ignorato });
    const res = blockingWarnings([
      w("A", "error"),
      w("B", "warn"),
      w("QUOTE_EXPIRED", "warn"),
      w("C", "error", true),
    ]);
    expect(res.map((x) => x.codice)).toEqual(["A", "QUOTE_EXPIRED"]);
  });

  it("shortDate", () => {
    expect(shortDate("2026-10-14 12:30:45")).toBe("2026-10-14 12:30");
    expect(shortDate("2026-10-14")).toBe("2026-10-14");
    expect(shortDate(null)).toBe("");
  });
});
