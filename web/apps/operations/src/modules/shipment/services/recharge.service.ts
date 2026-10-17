import { http } from "./http";

/**
 * Riaddebito (post-invoice recharge) REST client.
 *
 * Backend: tmwe_json\controller\api\fatturazione\Recharge_Controller
 * Service: tmwe_json\service\fatturazione\Recharge_Service
 *
 * The legacy ERP exposes the same flow via `spedy_riaddebito_ajax.php`
 * + `SpedizioneDelta()`. Modern endpoints honour the legacy business
 * rules: a shipment is eligible only when `controllo_fatt IN ('CA','NO','0')`
 * AND `id_fattura_a2 = 0`. Calling `apply` on an ineligible shipment
 * throws server-side; the dialog should disable the button instead.
 *
 * Fase 1 (2026-05-29): the delta is the RECALCULATED CLIENT PRICE minus the
 * invoiced carico (engine recomputes with the supplier real weight), NOT
 * costo_reale−costo_previsto. After apply, controllo_fatt stays 'CA' (the
 * legacy SpedizioneDelta does not set 'OK'); the secondary invoice
 * (id_fattura_a2) is created later by the legacy batch fatt_m_set.php.
 */

/** Per-supplement delta line returned by `Recharge_Service::calculate_delta`. */
export interface RechargeSupplementDelta {
  id: number;
  id_supplementi: number;
  delta: string; // 'N' | 'S' | 'A'
  attivo: string; // 'S' | 'N'
  supplement_name?: string;
}

/**
 * Shape returned by GET /api_recharge?op=calculate&shipment_id=N.
 * Mirrors `Recharge_Service::calculate_delta()`.
 */
export interface RechargePreview {
  shipment_id: number;
  operaz: "A" | "P"; // A=not invoiced (fix carico) | P=invoiced (postfatt)
  rif_cliente?: string;
  data_sped0?: string;
  carico_actual: number;
  prezzo_ricalcolato: number; // recalculated client price
  delta: number; // prezzo_ricalcolato − carico_actual
  fuel_actual: number;
  fuel_ricalcolato: number;
  delta_fuel: number;
  peso_tassato: number;
  pr1: number; // peso_fornit_reale (supplier real weight)
  peso_fornit_reale: number;
  differenza_peso: number; // round(pr1 − peso_tassato, 2), 0 if pr1<=ptax
  postfatt_txt_preview: string; // includes "Differenza peso: X Kg"
  supplements_delta: RechargeSupplementDelta[];
  currency: string;
  cli_rate: number;
  supplier_rate: number;
  id_fattura_a: number;
  id_fattura_a2: number;
  controllo_fatt: string;
  eligible: boolean;
  rate_available: boolean;
}

export interface RechargePreviewResponse {
  success: boolean;
  data?: RechargePreview;
  error?: string;
}

export interface RechargeApplyResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    action:
      | "recharge_applied"
      | "carico_updated"
      | "no_delta"
      | "carico_locked";
    operaz?: "A" | "P";
    delta_applied?: number;
    post_fuel_surc?: number;
    postfatt_txt?: string;
    carico?: number;
    controllo_fatt: string;
  };
  error?: string;
  message?: string;
}

/** Row of the pending/history listings (GET /api_recharge?op=pending|history). */
export interface RechargeListRow {
  id: number;
  rif_cliente?: string;
  data_sped0?: string;
  id_cliente: number;
  id_fornitore?: number;
  id_servizio?: number;
  peso_tassato: number;
  peso_fornit_reale?: number;
  colli?: number;
  costo_previsto: number;
  costo_reale: number;
  carico_cliente: number;
  postfatt: number;
  post_fuel_surc?: number;
  postfatt_txt?: string;
  id_fattura_a: number;
  id_fattura_a2?: number;
  id_fattura_p?: number;
  controllo_fatt: string;
  delta_peso?: number;
  cliente_nome?: string;
}

export interface RechargeListResponse {
  success: boolean;
  data?: RechargeListRow[];
  total?: number;
  page?: number;
  per_page?: number;
  error?: string;
}

/** View of the pending listing. */
export type RechargeView = "to_apply" | "faddebit2";

export const rechargeService = {
  /**
   * GET /api_recharge?op=pending — list shipments pending recharge.
   *
   * @param view 'to_apply' (controllo_fatt='CA', ready to apply)
   *           | 'faddebit2' (controllo_fatt='NO', invoice-control pending —
   *             the legacy dashboard "addebito differenze del corriere" list)
   */
  pending(
    view: RechargeView = "to_apply",
    page = 1,
    per_page = 50,
    filters: {
      date_from?: string;
      date_to?: string;
      id_fornitore?: number;
      invoice_id?: number;
      id_cliente?: number;
    } = {},
    opts: { signal?: AbortSignal } = {},
  ): Promise<RechargeListResponse> {
    return http<RechargeListResponse>("/api_recharge", {
      query: { op: "pending", view, page, per_page, ...filters },
      signal: opts.signal,
    });
  },

  /** GET /api_recharge?op=history — applied recharges (id_fattura_a2 > 0). */
  history(page = 1, per_page = 50): Promise<RechargeListResponse> {
    return http<RechargeListResponse>("/api_recharge", {
      query: { op: "history", page, per_page },
    });
  },

  /**
   * GET /api_recharge?op=calculate&shipment_id=N — preview delta without applying.
   *
   * Backwards-compat note: the controller reads `op=calculate` (the legacy
   * `action=calculate` clashed with app.php's dispatcher). We pass both
   * `id` and `shipment_id` so either branch accepts the request.
   */
  preview(shipment_id: number): Promise<RechargePreviewResponse> {
    return http<RechargePreviewResponse>("/api_recharge", {
      query: { op: "calculate", id: shipment_id, shipment_id },
    });
  },

  /**
   * POST /api_recharge op=apply — apply the recharge to the client.
   *
   * @param override_amount  optional manual amount (defaults to computed delta)
   * @param postfatt_txt     optional operator-edited invoice description
   *                         (defaults to the auto-composed text incl.
   *                          "Differenza peso: X Kg")
   */
  apply(
    shipment_id: number,
    override_amount?: number,
    postfatt_txt?: string,
  ): Promise<RechargeApplyResponse> {
    return http<RechargeApplyResponse>("/api_recharge", {
      method: "POST",
      body: { op: "apply", shipment_id, override_amount, postfatt_txt },
    });
  },
};
