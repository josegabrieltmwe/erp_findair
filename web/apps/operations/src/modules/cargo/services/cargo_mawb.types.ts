/**
 * WS-B — TS types for the cargo MAWB REST API.
 * Source of truth: docs/openapi/cargo/cargo_mawb.yaml
 */
export interface MawbAddress {
  nome: string;
  adress: string;
  cap?: string | null;
  citta: string;
  prov?: string | null;
  id_paese_iso: string;
  attenzione?: string | null;
  tel?: string | null;
  mail?: string | null;
}

export interface CargoMawb {
  id: number | string;
  id_cargo: number | string;
  tipo: "M";
  /**
   * Número de AWB. Campo DERIVADO de `spedizioni_cargo.AWB_forn`: no existe
   * como columna en `awb_cargo` (la tabla del MAWB), así que lo inyecta
   * `Awb_Service::with_awb_number()` al servir la ficha.
   */
  awb_number?: string | null;
  /** El número lo fijó una reserva viva en el carrier → solo lectura. */
  awb_locked?: boolean;
  /** De dónde viene el número: reserva del carrier o asignación manual. */
  awb_source?: "booking" | "manual";
  shipper?: MawbAddress | null;
  consignee?: MawbAddress | null;
  notify?: MawbAddress | null;
  issuing_carrier?: string | null;
  agent_iata_code?: string | null;
  at_place?: string | null;
  goods_descr?: string | null;
  accounting?: string | null;
  mnf_descr?: string | null;
  SSR?: string | null;
  OSI?: string | null;
  TACT?: string | number | null;
  TACT_MinimumCharge?: string | number | null;
  wvc?: string | null;
  oth_crg?: string | null;
  note_interne?: string | null;
  // Structured "other charges" — 8 legacy rows, each label/option/value.
  oth_crg_lab_1?: string | null;
  oth_crg_opz_1?: string | null;
  oth_crg_val_1?: string | number | null;
  oth_crg_lab_2?: string | null;
  oth_crg_opz_2?: string | null;
  oth_crg_val_2?: string | number | null;
  oth_crg_lab_3?: string | null;
  oth_crg_opz_3?: string | null;
  oth_crg_val_3?: string | number | null;
  oth_crg_lab_4?: string | null;
  oth_crg_opz_4?: string | null;
  oth_crg_val_4?: string | number | null;
  oth_crg_lab_5?: string | null;
  oth_crg_opz_5?: string | null;
  oth_crg_val_5?: string | number | null;
  oth_crg_lab_6?: string | null;
  oth_crg_opz_6?: string | null;
  oth_crg_val_6?: string | number | null;
  oth_crg_lab_7?: string | null;
  oth_crg_opz_7?: string | null;
  oth_crg_val_7?: string | number | null;
  oth_crg_lab_8?: string | null;
  oth_crg_opz_8?: string | null;
  oth_crg_val_8?: string | number | null;
  rated_as_agreed?: "S" | "N" | null;
  handling_SCI?: string | null;
  declared_val_carriage?: string | number | null;
  declared_val_customs?: string | number | null;
  signature_ragsoc?: string | null;
  signature_agent?: string | null;
  executed_date?: string | null;
  // Legacy flat fields (the backend returns awb_cargo row as-is):
  shipper_nome?: string | null;
  shipper_address?: string | null;
  shipper_cap?: string | null;
  shipper_citta?: string | null;
  shipper_prov?: string | null;
  shipper_paese?: string | null;
  shipper_tel?: string | null;
  shipper_mail?: string | null;
  shipper_attne?: string | null;
  consignee_nome?: string | null;
  consignee_address?: string | null;
  consignee_cap?: string | null;
  consignee_citta?: string | null;
  consignee_prov?: string | null;
  consignee_paese?: string | null;
  consignee_tel?: string | null;
  consignee_mail?: string | null;
  consignee_attne?: string | null;
  notify_nome?: string | null;
  notify_address?: string | null;
  notify_cap?: string | null;
  notify_citta?: string | null;
  notify_prov?: string | null;
  notify_paese?: string | null;
  notify_tel?: string | null;
  notify_mail?: string | null;
  notify_attne?: string | null;
  /** Options for the "Other charges" grid label select (from awb_other_charge). */
  _other_charge_options?: string[];
  [k: string]: unknown;
}

export interface CargoMawbPatch {
  awb_number?: string;
  shipper?: MawbAddress;
  consignee?: MawbAddress;
  notify?: MawbAddress;
  goods_descr?: string;
  SSR?: string;
  OSI?: string;
  TACT?: string | number;
  // Allow legacy flat columns directly too — backend accepts both.
  [k: string]: unknown;
}

/** Successful TACT rate lookup (`/api_cargo_tact_update` → data). */
export interface TactRateResult {
  shipment_id: number;
  tact: number;
  minimum_charge: number;
  weight_charge?: number | null;
  rate_type?: string | null;
  carrier_matched?: string | null;
  effective_date?: string | null;
  currency_code?: string | null;
}

/** Carrier alternative offered when the requested carrier has no rate. */
export interface TactAvailableCarrier {
  carrier_code?: string | null;
  carrier_name?: string | null;
  [k: string]: unknown;
}

/** `details` payload of a 404 `TACT_NO_RATE` error. */
export interface TactNoRateDetails {
  shipment_id?: number;
  origin?: string;
  destination?: string;
  requested_carrier?: string | null;
  available_carriers?: TactAvailableCarrier[];
}

export type AnagraficaPickerTipo =
  | "DST"
  | "PRS"
  | "SDE"
  | "XDST"
  | "XPRS"
  | "TMW"
  | "PRT";

export interface AnagraficaPickerRow {
  id: number;
  rag_soc: string;
  address: MawbAddress;
}
