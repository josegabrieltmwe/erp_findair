import { http } from "./http";

/**
 * COD capture sheets of a shipment: the photo of the paper a cheque was read
 * off, plus that cheque.
 *
 * WHY A SEPARATE SERVICE FROM files.service.ts
 * --------------------------------------------
 * Captures live in `spedizioni_files2` with `id_spedizione = 0`: one summary
 * sheet lists cheques for eight or nine different shipments and belongs to no
 * single one. The shipment files endpoint lists by shipment id, so it cannot
 * see them. The link runs shipment -> cheque -> sheet, which is what
 * api_shipment_cod_captures walks.
 *
 * Operator-only, like the files themselves: a remittance sheet shows OTHER
 * clients' cheques.
 *
 * GET ?shipment_id=N                              -> list
 * GET ?shipment_id=N&op=download&id_file=X&otp=Y   -> the image
 */
export interface CodCapture {
  id_file: number;
  /** Download key stored with the file row; without it the image 404s. */
  otp: string;
  nome: string;
  peso_kb: number;
  ruolo: string;
  id_session: number;
  numero_assegno: string;
  importo_cents: number;
  valuta: string;
  stato_match: string;
  created: string;
}

export interface CodCapturesResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    captures: CodCapture[];
  };
  error?: string;
}

export const codCapturesService = {
  list(shipment_id: number): Promise<CodCapturesResponse> {
    return http<CodCapturesResponse>("/api_shipment_cod_captures", {
      query: { shipment_id },
    });
  },

  /**
   * URL of the image itself.
   *
   * A plain URL rather than a fetch: it goes straight into <v-img>, so the
   * browser streams it and we never hold a base64 copy of a 100 KB photo in
   * memory. `op`, not `action` — the dispatcher reserves `action` for the route
   * name (same reason as files.service.ts).
   */
  downloadUrl(shipment_id: number, capture: CodCapture): string {
    const base = window.__TMWE_SHIPMENT__?.basePath ?? "/bff/v1";
    const query = new URLSearchParams({
      shipment_id: String(shipment_id),
      op: "download",
      id_file: String(capture.id_file),
      otp: capture.otp,
    });
    return `${base}/api_shipment_cod_captures?${query.toString()}`;
  },
};
