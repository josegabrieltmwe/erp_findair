import { http } from "./http";

/**
 * Proforma invoice REST client — wraps the modern `api_proforma_*`
 * controllers. Field names mirror the DB columns exactly (no legacy
 * aliases like `q`/`unit`/`prezzo`) — those aliases were used by the
 * old SPA mockup; the backend has only ever accepted the canonical
 * forms below.
 *
 * Tables behind the endpoints:
 *   `fattura_proforma`       (header — Proforma_Model)
 *   `fattura_proforma_dett`  (line items — Proforma_Detail_Model)
 */

export interface ProformaItem {
  id?: number | string;
  id_proforma?: number | string;
  descrizione: string;
  voce_doganale?: string;
  qta: number;
  qta_unit?: string;
  peso_netto?: number;
  peso_lordo?: number;
  peso_unit?: "K" | "L";
  valore: number;
  stato?: "A" | "O";
}

export interface ProformaHeader {
  iso_paese_origine?: string;
  motivo?: string;
  id_valuta?: number;
  data?: string;
}

export interface Proforma extends ProformaHeader {
  id: number | string;
  id_spedizione: number | string;
  items: ProformaItem[];
  total?: number;
  currency_code?: string;
  motivo_descr?: string;
}

export interface ProformaLookup {
  success: boolean;
  motivi?: Array<{ id: number; descr: string }>;
  units?: string[];
  valute?: Array<{ id: number; sigla: string }>;
  paesi?: Array<{ iso: string; nome: string }>;
}

export const proformaService = {
  // The backend (Proforma_Crud_Controller) keys on `id_spedizione`, not
  // `shipment_id`, in both the list filter and the create body — sending the
  // wrong name made GET return nothing and POST fail with "id_spedizione is
  // required". Map it here so callers keep using the SPA's shipment_id name.
  get(
    shipment_id: number,
  ): Promise<{ success: boolean; proforma?: Proforma | null }> {
    return http("/api_proforma_crud", {
      query: { id_spedizione: shipment_id },
    });
  },
  save(
    shipment_id: number,
    header: ProformaHeader,
    items: ProformaItem[],
  ): Promise<{ success: boolean; proforma?: Proforma; error?: string }> {
    return http("/api_proforma_crud", {
      method: "POST",
      body: { id_spedizione: shipment_id, ...header, items },
    });
  },
  duplicate(
    from_shipment_id: number,
    to_shipment_id: number,
  ): Promise<{ success: boolean }> {
    return http("/api_proforma_duplicate", {
      method: "POST",
      body: { from_shipment_id, to_shipment_id },
    });
  },
  async lookup(): Promise<ProformaLookup> {
    const [motivi, units] = await Promise.all([
      http<{ success: boolean; data?: Array<{ id: number; descr: string }> }>(
        "/api_proforma_lookup",
        { query: { type: "motivi" } },
      ),
      http<{ success: boolean; data?: string[] }>("/api_proforma_lookup", {
        query: { type: "units" },
      }),
    ]);
    return {
      success: true,
      motivi: motivi.data ?? [],
      units: units.data ?? [],
    };
  },
  generatePdf(
    shipment_id: number,
  ): Promise<{ success: boolean; file_id?: number; url?: string }> {
    return http("/ajax_generate_proforma_file", {
      method: "POST",
      body: { shipment_id },
    });
  },
};
