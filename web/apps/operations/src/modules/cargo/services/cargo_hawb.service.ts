import { http } from "./http";

export interface HawbRow {
  id: number | string;
  id_cargo: number | string;
  id_spediz?: number | string | null;
  tipo: "H";
  awb_number?: string | null;
  goods_descr?: string | null;
  peso_house?: number | string | null;
  [k: string]: unknown;
}

export interface HawbListResponse {
  items: HawbRow[];
}

export interface HawbCreate {
  id_spediz?: number | null;
  awb_number?: string;
  goods_descr?: string;
  peso_house?: number;
  // Address blocks accepted via flat legacy columns (shipper_nome, etc.)
  [k: string]: unknown;
}

export interface HawbPatch {
  awb_number?: string;
  goods_descr?: string;
  /** null clears the field; a non-numeric UI entry maps to null, never NaN. */
  peso_house?: number | null;
  id_spediz?: number | null;
  SSR?: string;
  OSI?: string;
  // Accept any awb_cargo column (shipper_*, consignee_*, notify_*,
  // declared_val_*, signature_*, etc.). The backend Awb_Service whitelists
  // updatable columns server-side, so passing extra keys is safe.
  [k: string]: unknown;
}

const BASE = "/api_cargo_hawb";

export const cargoHawbService = {
  list(cargo_id: number): Promise<HawbListResponse> {
    return http<HawbListResponse>(BASE, { query: { cargo_id } });
  },
  create(cargo_id: number, body: HawbCreate): Promise<HawbRow> {
    return http<HawbRow>(BASE, { method: "POST", query: { cargo_id }, body });
  },
  update(cargo_id: number, hawb_id: number, body: HawbPatch): Promise<HawbRow> {
    return http<HawbRow>(BASE, {
      method: "PATCH",
      query: { cargo_id, hawb_id },
      body: { cargo_id, hawb_id, ...body },
    });
  },
  remove(cargo_id: number, hawb_id: number): Promise<void> {
    return http(BASE, {
      method: "DELETE",
      query: { cargo_id, hawb_id },
      body: { cargo_id, hawb_id },
    }) as unknown as Promise<void>;
  },
};
