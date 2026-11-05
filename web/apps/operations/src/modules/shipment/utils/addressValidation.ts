/**
 * Validación de la dirección de la express (diálogo recogida/entrega) ANTES
 * del POST a ajax_shipment_addresses, y lectura de los errores de campo que
 * devuelva el API (`ajax_validation_error` → `{success:false,
 * error_code:'VALIDATION_ERROR', details:{fields}}`).
 *
 * Reglas (paridad Validate_Before_Ldv_Controller): nombre, dirección, país y
 * ciudad siempre; CAP si el país lo usa (usa_cap ≠ 'N'); provincia si es
 * obligatoria (usa_prov = 'S').
 */

/** Campos del buffer del diálogo (claves de ShipmentAddress). */
export type AddressField = "name" | "address" | "country" | "city" | "cap" | "prov";

/** Valor = clave i18n bajo shipment.modals.address, o texto del servidor. */
export type AddressErrors = Partial<Record<AddressField, string>>;

export interface AddressInput {
  name?: unknown;
  address?: unknown;
  country?: unknown;
  city?: unknown;
  cap?: unknown;
  prov?: unknown;
}

export interface CountryRules {
  /** usa_cap del catálogo ('N' = sin código postal). undefined = desconocido. */
  cap_enabled?: string;
  /** usa_prov del catálogo ('S' = obligatoria). */
  prov_enabled?: string;
}

function filled(v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => String(x ?? "").trim() !== "");
  return String(v ?? "").trim() !== "";
}

export function validateAddress(a: AddressInput, rules?: CountryRules | null): AddressErrors {
  const e: AddressErrors = {};
  if (!filled(a.name)) e.name = "err_required";
  if (!filled(a.address)) e.address = "err_required";
  if (!filled(a.country)) e.country = "err_required";
  if (!filled(a.city)) e.city = "err_required";
  // Sin datos del país no se exige CAP/provincia: lo validará el API.
  if (rules) {
    const cap = String(rules.cap_enabled ?? "").toUpperCase();
    if (cap !== "" && cap !== "N" && !filled(a.cap)) e.cap = "err_cap_required";
    if (String(rules.prov_enabled ?? "").toUpperCase() === "S" && !filled(a.prov)) {
      e.prov = "err_prov_required";
    }
  }
  return e;
}

/** Nombres del payload legacy / API → campo del diálogo. */
const API_FIELD: Record<string, AddressField> = {
  nome: "name",
  name: "name",
  adress: "address",
  address: "address",
  indirizzo: "address",
  id_paese_iso: "country",
  country: "country",
  paese: "country",
  citta: "city",
  city: "city",
  cap: "cap",
  zip: "cap",
  prov: "prov",
  provincia: "prov",
};

function fieldOf(key: string): AddressField | undefined {
  const k = key.toLowerCase().replace(/^address\./, "");
  return API_FIELD[k];
}

/**
 * Extrae errores por campo de una respuesta (o del `data` de un ApiError).
 * `details.fields` puede ser un objeto `{campo: mensaje}` o una lista de
 * mensajes («nome required», «cap: …»): en la lista se busca el nombre del
 * campo al principio del texto. Devuelve {} si no hay nada aprovechable.
 */
export function serverFieldErrors(raw: unknown): AddressErrors {
  const r = (raw ?? {}) as {
    error_code?: unknown;
    details?: { fields?: unknown } | null;
    fields?: unknown;
    error?: { details?: { fields?: unknown } } | unknown;
  };
  const nested = (r.error && typeof r.error === "object"
    ? (r.error as { details?: { fields?: unknown } }).details?.fields
    : undefined);
  const fields = r.details?.fields ?? r.fields ?? nested;
  const out: AddressErrors = {};
  if (!fields) return out;
  if (Array.isArray(fields)) {
    for (const item of fields) {
      const msg = String(item ?? "");
      const m = /^\s*([a-z_.]+)\b/i.exec(msg);
      const f = m ? fieldOf(m[1]) : undefined;
      if (f && !out[f]) out[f] = msg;
    }
    return out;
  }
  if (typeof fields === "object") {
    for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
      const f = fieldOf(k);
      if (!f || out[f]) continue;
      out[f] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
    }
  }
  return out;
}
