import { describe, expect, it } from "vitest";
import { copyErrorKey, extensionOf, sizeLabel, uploadErrorKey, uploadProblem, type UploadRules } from "./carrierOfferFiles";

const rules: UploadRules = { max_files: 4, max_kb: 3072, extensions: ["pdf", "png", "jpg", "tiff", "xlsx"], can_upload: true };

describe("carrierOfferFiles · antes de subir", () => {
  it("un fichero correcto se puede subir", () => {
    expect(uploadProblem({ name: "Rates.PDF", size: 2000 }, rules, 0)).toBeNull();
    expect(uploadProblem({ name: "scan.tiff", size: 3072 * 1024 }, rules, 3)).toBeNull();
  });

  it("rechaza lo que el API rechazaría", () => {
    expect(uploadProblem({ name: "a.php", size: 10 }, rules, 0)).toBe("upload_err_type");
    expect(uploadProblem({ name: "a", size: 10 }, rules, 0)).toBe("upload_err_type");
    expect(uploadProblem({ name: "a.pdf", size: 3072 * 1024 + 1 }, rules, 0)).toBe("upload_err_size");
    expect(uploadProblem({ name: "a.pdf", size: 0 }, rules, 0)).toBe("upload_err_empty");
  });

  it("no deja subir si no se puede (oferta revisada) o ya hay cuatro", () => {
    expect(uploadProblem({ name: "a.pdf", size: 10 }, { ...rules, can_upload: false }, 0)).toBe("upload_err_limit");
    expect(uploadProblem({ name: "a.pdf", size: 10 }, rules, 4)).toBe("upload_err_limit");
  });

  it("la extensión se lee en minúsculas y solo la última", () => {
    expect(extensionOf("A.B.PDF")).toBe("pdf");
    expect(extensionOf("sin")).toBe("");
    expect(extensionOf("a.pdf.php")).toBe("php");
  });
});

describe("carrierOfferFiles · errores del servidor", () => {
  it("cada código tiene su texto", () => {
    expect(uploadErrorKey("FILE_TOO_BIG", 400)).toBe("upload_err_size");
    expect(uploadErrorKey("FILE_TYPE_NOT_ALLOWED", 400)).toBe("upload_err_type");
    expect(uploadErrorKey("FILE_LIMIT_REACHED", 409)).toBe("upload_err_limit");
    expect(uploadErrorKey("OFFER_LOCKED", 409)).toBe("upload_err_locked");
    expect(uploadErrorKey("NO_FILE", 400)).toBe("upload_err_empty");
    expect(uploadErrorKey(undefined, 413)).toBe("upload_err_size");
    expect(uploadErrorKey("OTHER", 413)).toBe("upload_err_size");
    expect(uploadErrorKey(undefined, 429)).toBe("err_rate");
    expect(uploadErrorKey(undefined, 500)).toBe("upload_err_generic");
  });

  it("la copia por correo", () => {
    expect(copyErrorKey("RECIPIENT_MISSING")).toBe("receipt_err_missing");
    expect(copyErrorKey("SEND_FAILED")).toBe("receipt_err");
    expect(copyErrorKey(undefined)).toBe("receipt_err");
  });

  it("tamaños legibles", () => {
    expect(sizeLabel(12)).toBe("12 KB");
    expect(sizeLabel(2560)).toBe("2.5 MB");
  });
});
