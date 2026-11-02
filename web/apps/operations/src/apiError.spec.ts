import { describe, expect, it } from "vitest";
import {
  apiErrorCode,
  apiErrorDetails,
  apiFieldErrors,
  caughtText,
  errorText,
  localizedErrorText,
} from "@shared/utils/apiError";
import { ApiError } from "@shared/anagrafiche/services/api.types";
import { scaglioniService } from "@shared/anagrafiche/services/scaglioni.service";

// Cuerpo canónico de Api_Error::body
function body(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    error_code: code,
    message,
  };
}

describe("errorText", () => {
  it("texto, objeto {code,message} y vacíos", () => {
    expect(errorText("boom")).toBe("boom");
    expect(errorText({ code: "X", message: "Mensaje" })).toBe("Mensaje");
    expect(errorText({ code: "X" })).toBe("X");
    expect(errorText(undefined, "Fallback")).toBe("Fallback");
    expect(errorText({})).toBe("Error");
  });
});

describe("caughtText", () => {
  it("nunca devuelve [object Object]", () => {
    expect(caughtText(new Error("a"))).toBe("a");
    expect(caughtText({ code: "C", message: "m" })).toBe("m");
    expect(caughtText(42, "f")).toBe("f");
  });
});

describe("apiErrorCode / details / campos", () => {
  const e403 = new ApiError("Solo root", 403, "FORBIDDEN", body("ROLE_ROOT_ONLY", "Solo root"));
  it("lee el código real del cuerpo aunque el cliente ponga FORBIDDEN", () => {
    expect(apiErrorCode(e403)).toBe("ROLE_ROOT_ONLY");
  });
  it("usa el código del propio error si no hay cuerpo", () => {
    expect(apiErrorCode(new ApiError("x", 400, "ABC"))).toBe("ABC");
    expect(apiErrorCode(new Error("x"))).toBeNull();
  });
  it("campos de un 422 de formato (P51)", () => {
    const e = new ApiError(
      "mail: formato de email no valido; cap: 3 a 10",
      422,
      "VALIDATION_ERROR",
      body("VALIDATION_ERROR", "m", { fields: { mail: "mail: formato de email no valido", cap: "cap: 3 a 10", n: 3 } }),
    );
    expect(apiFieldErrors(e)).toEqual({
      mail: "mail: formato de email no valido",
      cap: "cap: 3 a 10",
    });
    expect(apiErrorDetails(e).fields).toBeDefined();
    expect(apiFieldErrors(new Error("x"))).toEqual({});
  });
});

describe("localizedErrorText", () => {
  const dict: Record<string, string> = { "errors.api.COD_DATE_FUTURE": "Fecha futura" };
  const i18n = { t: (k: string) => dict[k], te: (k: string) => k in dict };
  it("traduce por código si hay clave", () => {
    const e = new ApiError("collection_date cannot be in the future", 400, "COD_DATE_FUTURE",
      body("COD_DATE_FUTURE", "collection_date cannot be in the future"));
    expect(localizedErrorText(e, i18n)).toBe("Fecha futura");
  });
  it("sin clave, el mensaje del servidor", () => {
    const e = new ApiError("Invalid value for pr01: must be >= 0", 400, "UPDATE_ERROR",
      body("UPDATE_ERROR", "Invalid value for pr01: must be >= 0"));
    expect(localizedErrorText(e, i18n)).toBe("Invalid value for pr01: must be >= 0");
  });
});

describe("servicios: error del API como objeto", () => {
  it("scaglioni (P48) no lanza [object Object] ante success:false con error objeto", async () => {
    const g = globalThis as unknown as { fetch: unknown };
    const prev = g.fetch;
    g.fetch = async () =>
      new Response(JSON.stringify(body("UPDATE_ERROR", "Invalid value for pr01: must be >= 0")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    try {
      await expect(
        scaglioniService.updateField(1, "E", "pr01", -1),
      ).rejects.toThrow("Invalid value for pr01: must be >= 0");
    } finally {
      g.fetch = prev;
    }
  });
});
