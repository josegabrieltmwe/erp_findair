import { http } from "./http";

/**
 * La solicitud de cotización tal como la ve la aerolínea (legado vttoff.php). No hay usuario: la sesión la abrió el OTP del
 * correo (`bootstrapOtp`) y el BFF pone `id` y `otp` desde su concesión; aquí no se envía ninguno de los dos.
 */

export type CarrierOfferState = "open" | "answered" | "locked";

export interface CarrierCharge {
  id: number;
  tipo: string | null;
  /** `kg` (por kilo tasable), `fix` (fijo) o `box` (por bulto). */
  type: string | null;
  code: string | null;
  nome: string | null;
  costo_unit: string | number | null;
  costo_min: string | number | null;
  costo_max: string | number | null;
  costo_unitV: string | number | null;
  costo_minV: string | number | null;
  costo_maxV: string | number | null;
}

export interface CarrierParcel {
  n: number;
  weight: number;
  height: number;
  side1: number;
  side2: number;
  turnable: boolean;
  stackable: boolean;
}

export interface CarrierOfferView {
  id: number;
  state: CarrierOfferState;
  /** Qué puede hacer: `view`, y `answer` mientras no esté revisada. */
  scopes: string[];
  expires_at: number | null;
  carrier: string;
  requested_at: string | null;
  answered_at: string | null;
  request_note: string;
  currency: string;
  total: number;
  chargeable_weight: number;
  charges: CarrierCharge[];
  reply: { note: string; schedule: string; reference: string };
  freight: {
    parcels_count: number;
    weight: number;
    volume: number;
    departure: string;
    arrival: string;
    goods: string;
    pallets: boolean;
  };
  parcels: CarrierParcel[];
  files: Array<{ id: number; name: string; size_kb: number }>;
  own_files: Array<{ n: number; name: string }>;
  /** Lo que la pantalla ofrece y valida antes de subir un fichero. */
  upload: { max_files: number; max_kb: number; extensions: string[]; can_upload: boolean };
}

export interface CarrierOfferResponse {
  success: boolean;
  found: boolean;
  data?: CarrierOfferView;
}

export interface CarrierQuoteResponse {
  success: boolean;
  state?: "submitted";
  /** El total que calculó el SERVIDOR (puede diferir del que mostraba la pantalla). */
  total?: number;
  currency?: string;
  answered_at?: string;
}

export interface CarrierQuoteBody {
  lines: Array<{ id: number; costo_unitV: number; costo_minV: number; costo_maxV: number }>;
  chargeable_weight: number;
  note: string;
  schedule: string;
  reference: string;
  confirm: { price: boolean; terms: boolean };
}

export interface CarrierUploadResponse {
  success: boolean;
  slot?: number;
  name?: string;
}

export interface CarrierCopyResponse {
  success: boolean;
  /** Dirección registrada, enmascarada (`o***@klm.example`). */
  sent_to?: string;
}

function basePath(): string {
  return (typeof window !== "undefined" && (window as unknown as { __TMWE_NAV__?: { basePath?: string } }).__TMWE_NAV__?.basePath) || "/bff/v1";
}

/**
 * Enlaces de descarga. Son navegaciones GET a rutas del BFF con la cookie de la sesión de OTP (sin token ni OTP en la URL): el
 * API contesta como adjunto y el navegador baja el fichero sin salir de la página.
 */
export const carrierOfferLinks = {
  sharedFile: (id: number): string => `${basePath()}/api_carrier_offer_file?idf=${encodeURIComponent(String(id))}`,
  ownFile: (n: number): string => `${basePath()}/api_carrier_offer_file?n=${encodeURIComponent(String(n))}`,
  packages: (): string => `${basePath()}/api_carrier_offer_packages`,
  pdf: (): string => `${basePath()}/api_carrier_offer_pdf`,
};

export const carrierOfferService = {
  /** GET /api_carrier_offer — `found: false` si el enlace ya no sirve (caducado o retirado). */
  get(): Promise<CarrierOfferResponse> {
    return http<CarrierOfferResponse>("/api_carrier_offer");
  },

  /** POST /api_carrier_offer_file — sube un fichero de la aerolínea (multipart, campo `file`). */
  uploadFile(file: File): Promise<CarrierUploadResponse> {
    const body = new FormData();
    body.append("file", file, file.name);
    return http<CarrierUploadResponse>("/api_carrier_offer_file", { method: "POST", body });
  },

  /** POST /api_carrier_offer_pdf — manda el PDF al contacto REGISTRADO de la aerolínea (no se elige el destinatario). */
  sendPdfCopy(): Promise<CarrierCopyResponse> {
    return http<CarrierCopyResponse>("/api_carrier_offer_pdf", { method: "POST", body: {} });
  },

  /**
   * POST /api_carrier_offer — la aerolínea responde. Sin `id` ni `otp` (los pone el BFF desde la sesión) y sin total (lo calcula
   * el servidor). Errores: 400 VALIDATION_ERROR (`error.details.fields`) / CONFIRMATION_REQUIRED, 409 OFFER_LOCKED.
   */
  submit(body: CarrierQuoteBody): Promise<CarrierQuoteResponse> {
    return http<CarrierQuoteResponse>("/api_carrier_offer", { method: "POST", body });
  },
};
