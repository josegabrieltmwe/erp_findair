import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Vettori (carrier) + AWB stock + IATA agent metadata.
 *
 * Wraps three parity-v7 controllers added to the cargo modernization
 * branch:
 *
 *   - api_cargo_vettori_list        → Web_Cargo_Vettori_List_Controller
 *   - api_cargo_awb_vettori_list    → Web_Awb_Vettori_List_Controller
 *   - api_cargo_mawb_agent          → Web_Mawb_Agent_Controller
 *
 * Used by CargoVettoriBox.vue (carrier picker) and CargoMawbForm.vue
 * (AWB picker + IATA agent application).
 */

export interface VettoreOption {
  id: number;
  sigla: string;
  nome: string;
  label: string;
  /** Count of unassigned, non-expired AWBs allocated to the iso-partner pair. */
  awbs_available: number;
  /**
   * `awbs_available > 0`. Informational: the list is scoped by which
   * carriers the partner can email, NOT by who holds AWB stock — an RFQ
   * is sent before any AWB exists.
   */
  has_awb_stock?: boolean;
}

export interface VettoriListPayload {
  cargo_id: number;
  terminal_part: string;
  terminal_dest: string;
  iso_from: string;
  iso_dest: string;
  partner_id: number;
  client: {
    id: number;
    valuta_sigla: string;
    metric_imperial: string;
  } | null;
  carriers: VettoreOption[];
  count: number;
}

export interface AwbStockItem {
  awb: string;
  expires_at: string;
}

export interface AwbStockPayload {
  cargo_id: number;
  vettore: {
    id: number;
    sigla: string;
    nome: string;
    label: string;
  } | null;
  partner_id: number;
  awbs: AwbStockItem[];
  count: number;
  /** Present when no carrier is selected yet on the cargo. */
  note?: string;
}

export interface IataAgentMetadata {
  issuing_carrier: string;
  agent_iata_code: string;
  at_place: string;
  signature_ragsoc: string;
  signature_agent: string;
}

export interface MawbAgentApplyResult {
  cargo_id: number;
  partner_id: number;
  rows_updated: number;
  agent: IataAgentMetadata;
}

export const vettoriService = {
  /**
   * api_cargo_vettori_list — available carriers for the cargo's route.
   *
   * Optional `terminal_part_override` lets the UI run a what-if pricing
   * against an arbitrary departure terminal without modifying the cargo.
   */
  listCarriers(
    cargo_id: number,
    terminal_part_override?: string,
  ): Promise<ApiEnvelope<VettoriListPayload>> {
    const query: Record<string, string | number> = { cargo_id };
    if (terminal_part_override) {
      query.terminal_part_override = terminal_part_override;
    }
    return http<ApiEnvelope<VettoriListPayload>>("/api_cargo_vettori_list", {
      query,
    });
  },

  /**
   * api_cargo_awb_vettori_list — AWB stock for the carrier currently
   * selected on the cargo. Returns empty when no carrier is set.
   */
  listAwbStock(cargo_id: number): Promise<ApiEnvelope<AwbStockPayload>> {
    return http<ApiEnvelope<AwbStockPayload>>("/api_cargo_awb_vettori_list", {
      query: { cargo_id },
    });
  },

  /**
   * api_cargo_mawb_agent — apply IATA agent metadata to every awb_cargo
   * row of the cargo (master + houses). POST-only by contract; the
   * backend resolves the agent through terminal_part → iso → webcargo_key
   * → anagrafiche_more, with TMWE root (anagrafica id 1) as fallback.
   */
  applyIataAgent(cargo_id: number): Promise<ApiEnvelope<MawbAgentApplyResult>> {
    return http<ApiEnvelope<MawbAgentApplyResult>>("/api_cargo_mawb_agent", {
      method: "POST",
      body: { cargo_id },
    });
  },

  /**
   * api_cargo_awb_request — ask an airline to allocate new AWB numbers to the
   * partner. Sends through the RabbitMQ mail worker, so it returns as soon as
   * the message is queued.
   *
   * `used_fallback` means no `modelli` AWBREQUEST template exists for the
   * partner and the built-in English text was sent instead — surfaced so
   * somebody configures the template.
   */
  requestAwbStock(body: {
    id_vettore: number;
    partner_id: number;
    qty?: number;
    note?: string;
    extra_to?: string[];
    /** Reenviar pese al enfriamiento de 7 días (decisión explícita). */
    force?: boolean;
  }): Promise<ApiEnvelope<{ sent_to: string; used_fallback: boolean }>> {
    return http<ApiEnvelope<{ sent_to: string; used_fallback: boolean }>>(
      "/api_cargo_awb_request",
      { method: "POST", body },
    );
  },

  /**
   * api_cargo_awb_vettori_set — reserve a specific AWB of the vettore's stock
   * for the cargo (legacy spedyc_vtt_awb_set parity). Unlike a plain PATCH of
   * AWB_forn, this decrements the stock, releases the previously-held AWB and
   * records the AWB history server-side.
   */
  reserveAwb(
    cargo_id: number,
    id_vettore: number,
    awb: string,
  ): Promise<{ success: boolean; awb?: string; error?: string }> {
    return http("/api_cargo_awb_vettori_set", {
      method: "POST",
      body: { cargo_id, id_vettore, awb },
    });
  },
};
