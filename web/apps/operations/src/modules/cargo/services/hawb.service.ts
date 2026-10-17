import { http } from "./http";

/**
 * HAWB (House Air Waybill) service for cargo. Modern controller chain:
 *
 *   - GET /api_cargo_hawb?cargo_id=N → { items: HawbRow[] }
 *
 * NOTE: this used to call `/api_cargo_hawb_list`, a route that never existed
 * (404, swallowed by the catch → empty list). The real list endpoint is
 * `api_cargo_hawb` (Web_Cargo_Hawb_Crud_Controller, GET). Create/edit still
 * open the legacy single-HAWB form until WS-3 phase 2.
 */

export interface HawbRow {
  id: number;
  awb_number: string;
  id_spediz: number;
  shipper_name: string;
  consignee_name: string;
  pieces: number;
  weight: number;
  currency: string;
  created_at: string;
  status: string;
}

/** Raw row from api_cargo_hawb (mysqli strings + legacy column names). */
interface HawbRawRow {
  id: number | string;
  awb_number?: string | null;
  id_spediz?: number | string | null;
  goods_descr?: string | null;
  peso_house?: number | string | null;
  [k: string]: unknown;
}

interface ListResponse {
  items?: HawbRawRow[];
}

export const hawbService = {
  async list(cargoId: number): Promise<HawbRow[]> {
    try {
      const r = await http<ListResponse>("/api_cargo_hawb", {
        query: { cargo_id: cargoId },
      });
      const rows = Array.isArray(r?.items) ? r.items : [];
      return rows.map((x) => ({
        id: Number(x.id),
        awb_number: String(x.awb_number ?? ""),
        id_spediz: Number(x.id_spediz ?? 0),
        shipper_name: String((x.shipper_name as string) ?? ""),
        consignee_name: String((x.consignee_name as string) ?? ""),
        pieces: Number((x.pieces as number) ?? 0),
        weight: Number(x.peso_house ?? (x.weight as number) ?? 0),
        currency: String((x.currency as string) ?? "EUR"),
        created_at: String((x.created_at as string) ?? ""),
        status: String((x.status as string) ?? "A"),
      }));
    } catch {
      return [];
    }
  },

  /** Legacy form for create/edit — opens in a new tab until WS-3 phase 2. */
  openLegacyForm(cargoId: number, hawbId?: number): void {
    const url = hawbId
      ? `/erp/spedyc_hawb_form.php?idspd=${hawbId}&idcrg=${cargoId}`
      : `/erp/spedyc_hawb_form.php?idspd=0&idcrg=${cargoId}`;
    window.open(url, "_blank");
  },
};
