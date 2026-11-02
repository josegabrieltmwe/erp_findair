import { describe, expect, it } from "vitest";
import { ApiError } from "@shared/anagrafiche/services/api.types";
import { mfaCodeErrorMessage } from "@shared/mfa_setup/services/mfa.service";

const t = (k: string) => `T:${k}`;

describe("mfaCodeErrorMessage (H2)", () => {
  it("un 403 por codigo TOTP erroneo no se muestra como 'Forbidden'", () => {
    expect(mfaCodeErrorMessage(new ApiError("Forbidden", 403, "FORBIDDEN"), t)).toBe("T:mfa_setup.code_invalid");
    expect(mfaCodeErrorMessage(new ApiError("Acceso denegado", 401), t)).toBe("T:mfa_setup.code_invalid");
  });

  it("otros errores conservan su mensaje", () => {
    expect(mfaCodeErrorMessage(new ApiError("Too many requests", 429), t)).toBe("Too many requests");
    expect(mfaCodeErrorMessage("boom", t)).toBe("boom");
  });
});
