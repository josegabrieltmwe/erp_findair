import { http } from "./http";

/**
 * La solicitud de cotización de una expedición courier tal como la ve quien la recibe: un courier o una anagrafica de
 * tipo partner. No hay usuario: la sesión la abrió el OTP del correo (`bootstrapOtp`) y el BFF pone `id` y `otp` desde su
 * concesión; aquí no se envía ninguno de los dos. Backend: `GET|POST /api_courier_offer`.
 */

export type CourierOfferState = "open" | "answered" | "locked";

export interface CourierPackage {
  n: number;
  peso: string | number;
  lung: number;
  larg: number;
  alt: number;
  tipo: string;
}

export interface CourierShipment {
  origin: string | null;
  destination: string | null;
  weight: string | number | null;
  weight_taxed: string | number | null;
  colli: number | null;
  volume_m3: number | null;
  packages: CourierPackage[];
  contents: string;
  supplements: Array<{ name: string }>;
  cod: { amount: number; currency: string } | null;
  is_dgr: boolean;
  dgr: Array<{ un_number: string; hazard_class: string; packing_group: string; regulation: string }>;
}

export interface CourierOfferView {
  /** Nº de la solicitud que ve el destinatario (la expedición). */
  id_spedizione: number;
  data_rich: string | null;
  data_risp: string | null;
  txt_richiesta: string | null;
  txt_risposta: string | null;
  txt_schedule: string | null;
  costo: string | number | null;
  change_valuta: string | null;
  accettata: "S" | "N" | string;
  submittable: boolean;
  shipment: CourierShipment;
  kind: "courier" | "partner";
  /** Nombre de quien recibió la solicitud. */
  recipient: string;
  state: CourierOfferState;
  scopes: string[];
  expires_at: number | null;
}

export interface CourierOfferResponse {
  success: boolean;
  found?: boolean;
  data?: CourierOfferView;
}

export interface CourierQuoteBody {
  costo: number;
  change_valuta: string;
  txt_risposta: string;
  txt_schedule: string;
  confirm: { price: boolean; terms: boolean };
}

export interface CourierQuoteResponse {
  success: boolean;
  state?: string;
  total?: number;
  currency?: string;
  answered_at?: string;
}

export const courierOfferService = {
  /** GET /api_courier_offer — `found: false` si el enlace ya no sirve (caducado, retirado o en modo informar). */
  get(): Promise<CourierOfferResponse> {
    return http<CourierOfferResponse>("/api_courier_offer");
  },

  /** POST /api_courier_offer — responde (una sola vez). 400 VALIDATION_ERROR (`error.details.fields`) / CONFIRMATION_REQUIRED, 409 OFFER_LOCKED. */
  submit(body: CourierQuoteBody): Promise<CourierQuoteResponse> {
    return http<CourierQuoteResponse>("/api_courier_offer", { method: "POST", body });
  },
};
