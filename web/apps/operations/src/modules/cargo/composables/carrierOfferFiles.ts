import type { CarrierOfferView } from "@cargo/services/carrier_offer.service";

/**
 * Subida de ficheros de la aerolínea (legado vttoff_file_list.php: hasta 4, 3 MB, pdf doc xls gif png jpg tif…). Lógica pura:
 * la pantalla avisa antes de subir; el API vuelve a comprobar el tipo REAL del contenido, el tamaño y el número.
 */

export interface UploadCandidate {
  name: string;
  size: number;
}

export type UploadRules = CarrierOfferView["upload"];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Clave i18n (bajo `cargo.carrierOffer.`) del primer motivo por el que NO se puede subir, o null si se puede. */
export function uploadProblem(file: UploadCandidate, rules: UploadRules, ownCount: number): string | null {
  if (!rules.can_upload || ownCount >= rules.max_files) return "upload_err_limit";
  if (file.size <= 0) return "upload_err_empty";
  if (file.size > rules.max_kb * 1024) return "upload_err_size";
  if (!rules.extensions.includes(extensionOf(file.name))) return "upload_err_type";
  return null;
}

/** Código de error del API → clave i18n. */
export function uploadErrorKey(code: string | undefined, status: number | undefined): string {
  // 413: el BFF (o PHP) cortó la subida por tamaño antes de llegar al API.
  if (status === 413) return "upload_err_size";
  switch (code) {
    case "FILE_TOO_BIG":
      return "upload_err_size";
    case "FILE_TYPE_NOT_ALLOWED":
      return "upload_err_type";
    case "FILE_LIMIT_REACHED":
      return "upload_err_limit";
    case "OFFER_LOCKED":
      return "upload_err_locked";
    case "NO_FILE":
      return "upload_err_empty";
    default:
      return status === 429 ? "err_rate" : "upload_err_generic";
  }
}

/** «12 KB» / «2.4 MB» para la lista. */
export function sizeLabel(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toLocaleString("en", { maximumFractionDigits: 1 })} MB`;
  return `${kb} KB`;
}

/** Código de error de la copia por correo → clave i18n. */
export function copyErrorKey(code: string | undefined): string {
  return code === "RECIPIENT_MISSING" ? "receipt_err_missing" : "receipt_err";
}
