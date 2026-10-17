import { http } from "./http";
import type {
  CargoMawb,
  CargoMawbPatch,
  AnagraficaPickerRow,
  AnagraficaPickerTipo,
  TactRateResult,
} from "./cargo_mawb.types";

const MAWB_BASE = "/api_cargo_mawb";
const PICKER_BASE = "/api_anagrafiche_picker";

export const cargoMawbService = {
  get(cargo_id: number): Promise<CargoMawb> {
    return http<CargoMawb>(MAWB_BASE, { query: { cargo_id } });
  },
  patch(cargo_id: number, body: CargoMawbPatch): Promise<CargoMawb> {
    return http<CargoMawb>(MAWB_BASE, {
      method: "PATCH",
      query: { cargo_id },
      // cargo_id also in body as a fallback against a lost query string.
      body: { cargo_id, ...body },
    });
  },

  /**
   * MAWB confirmation gate (legacy spedyc_html_mawb_confirmation.php).
   * Allowed only when a master MAWB is still pending and the flight hasn't
   * departed. `already_done` means it has been confirmed before.
   */
  confirmationGate(cargo_id: number): Promise<{
    success: boolean;
    confirmation_allowed: boolean;
    confirmation_already_done: boolean;
  }> {
    return http("/api_cargo_mawb_confirmation", { query: { cargo_id } });
  },

  confirm(cargo_id: number): Promise<{
    success: boolean;
    confirmation_done?: boolean;
    error?: string;
  }> {
    return http("/api_cargo_mawb_confirmation", {
      method: "POST",
      body: { cargo_id },
    });
  },

  /**
   * TACT rate lookup — paridad con legacy botón ► (`AwbSetTxt`/`query`).
   * The backend queries the IATA TACT worker, stores TACT/min charge on
   * `awb_cargo` and returns the rate. On no-rate it throws an ApiError with
   * `errorCode === 'TACT_NO_RATE'` and `payload.details.available_carriers`.
   * `id` is the shipment (`spedizioni_cargo.id`), i.e. the cargo id.
   */
  tactLookup(cargo_id: number): Promise<TactRateResult> {
    return http<{ data: TactRateResult }>("/api_cargo_tact_update", {
      method: "POST",
      body: { id: cargo_id },
    }).then((r) => r.data);
  },
};

export const anagraficaPickerService = {
  search(
    q: string,
    tipo?: AnagraficaPickerTipo,
    limit = 20,
  ): Promise<AnagraficaPickerRow[]> {
    const query: Record<string, string | number> = { q, limit };
    if (tipo) query.tipo = tipo;
    return http<AnagraficaPickerRow[]>(PICKER_BASE, { query });
  },
};

const ADDR_PICKER_BASE = "/api_awb_address_picker";

/** Well-known AWB address sources (legacy cheaddr). */
export type AwbAddressSource =
  | "destinazione"
  | "presa"
  | "destinazione_express"
  | "presa_express"
  | "sede"
  | "tmwe"
  | "partner";

export interface AwbAddressPickerResult {
  /** Address fields, prefixed (shipper_/consignee_/notify_) when `prefix` given. */
  fields: Record<string, string | null>;
  source: string;
  anagrafica_id: number | null;
}

/**
 * Resolve a well-known address (destination/pickup/sede/TMWE/partner) to
 * pre-fill an AWB shipper/consignee/notify block. Replaces the legacy
 * `spedyc_awb_addr_ajax.php` AwbAddrSet flow. `prefix` rewraps the keys so
 * they map straight onto the awb_cargo columns.
 */
export const awbAddressPickerService = {
  resolve(
    cargo_id: number,
    source: AwbAddressSource,
    prefix?: "shipper_" | "consignee_" | "notify_",
    spediz_id?: number,
  ): Promise<AwbAddressPickerResult> {
    const query: Record<string, string | number> = { cargo_id, source };
    if (prefix) query.prefix = prefix;
    if (spediz_id) query.spediz_id = spediz_id;
    // El backend responde {success, data:{fields, source, anagrafica_id}}.
    // Hay que desenvolver `.data`; antes se leía el body crudo y `res.fields`
    // salía undefined → el bloque de direcciones se rellenaba vacío.
    return http<{ success: boolean; data: AwbAddressPickerResult }>(
      ADDR_PICKER_BASE,
      { query },
    ).then((r) => r.data);
  },
};
